const { db } = require('../firebase');
const { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  orderBy 
} = require('firebase/firestore');

// Helper to determine if password is a bcrypt hash
const isBcryptHash = (str) => typeof str === 'string' && str.length === 60 && (str.startsWith('$2a$') || str.startsWith('$2b$'));

// Helper to perform MongoDB query matching in memory
function matchQuery(item, queryObj) {
  for (let key in queryObj) {
    const val = queryObj[key];
    
    // Handle $or operator
    if (key === '$or') {
      if (!Array.isArray(val)) return false;
      const anyMatch = val.some(subQuery => matchQuery(item, subQuery));
      if (!anyMatch) return false;
      continue;
    }

    const itemVal = item[key];

    // Handle operator objects (like $regex, $lt, $gt)
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      for (let op in val) {
        const opVal = val[op];
        if (op === '$regex') {
          const options = val['$options'] || '';
          const regex = new RegExp(opVal, options);
          if (!regex.test(itemVal || '')) return false;
        } else if (op === '$options') {
          continue; // handled by $regex
        } else if (op === '$lt') {
          let dateA = itemVal;
          let dateB = opVal;
          if (dateA instanceof Date) dateA = dateA.getTime();
          if (dateB instanceof Date) dateB = dateB.getTime();
          if (!(dateA < dateB)) return false;
        } else if (op === '$gt') {
          let dateA = itemVal;
          let dateB = opVal;
          if (dateA instanceof Date) dateA = dateA.getTime();
          if (dateB instanceof Date) dateB = dateB.getTime();
          if (!(dateA > dateB)) return false;
        } else {
          if (itemVal !== opVal) return false;
        }
      }
    } else {
      // Exact match
      // If query is '_id', handle string conversion for compatibility
      if (key === '_id') {
        const queryIdStr = val?.toString();
        const itemIdStr = itemVal?.toString() || item.id?.toString() || item._id?.toString();
        if (itemIdStr !== queryIdStr) return false;
      } else {
        if (itemVal !== val) return false;
      }
    }
  }
  return true;
}

// Chained Query Builder for Mongoose syntax compatibility
class FirestoreQueryBuilder {
  constructor(collectionName, modelClass, queryObj = {}) {
    this.collectionName = collectionName;
    this.modelClass = modelClass;
    this.queryObj = queryObj;
    this._limit = null;
    this._skip = 0;
    this._sort = null;
    this._populateFields = [];
    this._isFindOne = false;
  }

  populate(field, selectFields) {
    this._populateFields.push({ field, selectFields });
    return this;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  skip(skipValue) {
    this._skip = skipValue;
    return this;
  }

  limit(limitValue) {
    this._limit = limitValue;
    return this;
  }

  select(selectFields) {
    // Stub for select compatibility
    return this;
  }

  async execute() {
    const colRef = collection(db, this.collectionName);
    const querySnapshot = await getDocs(colRef);
    let results = [];

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      
      // Map date timestamps back to Date objects
      const mappedData = { ...data };
      for (let k in mappedData) {
        if (mappedData[k] && typeof mappedData[k].toDate === 'function') {
          mappedData[k] = mappedData[k].toDate();
        }
      }

      results.push({
        _id: docSnap.id,
        id: docSnap.id,
        ...mappedData
      });
    });

    // Apply filters in-memory
    if (this.queryObj && Object.keys(this.queryObj).length > 0) {
      results = results.filter(item => matchQuery(item, this.queryObj));
    }

    // Apply sorting
    if (this._sort) {
      const sortField = Object.keys(this._sort)[0];
      const sortOrder = this._sort[sortField]; // 1 for asc, -1 for desc
      results.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA instanceof Date) valA = valA.getTime();
        if (valB instanceof Date) valB = valB.getTime();

        if (valA < valB) return sortOrder === -1 ? 1 : -1;
        if (valA > valB) return sortOrder === -1 ? -1 : 1;
        return 0;
      });
    } else {
      // Default fallback descending sorting by timestamp/createdAt/date fields
      results.sort((a, b) => {
        let dateA = a.createdAt || a.timestamp || a.issueDate || 0;
        let dateB = b.createdAt || b.timestamp || b.issueDate || 0;
        if (dateA instanceof Date) dateA = dateA.getTime();
        if (dateB instanceof Date) dateB = dateB.getTime();
        return dateB - dateA;
      });
    }

    // Apply pagination (skip and limit)
    const totalCount = results.length;
    const startIdx = this._skip || 0;
    const endIdx = this._limit ? startIdx + this._limit : totalCount;
    let paginatedResults = results.slice(startIdx, endIdx);

    // Apply population fetching reference collections dynamically
    if (this._populateFields.length > 0) {
      for (const pop of this._populateFields) {
        for (const item of paginatedResults) {
          const refId = item[pop.field];
          if (refId) {
            let refColName = '';
            if (pop.field === 'issuedBy') refColName = 'users';
            else if (pop.field === 'certificateRef') refColName = 'certificates';

            if (refColName) {
              const refDocRef = doc(db, refColName, refId.toString());
              const refSnap = await getDoc(refDocRef);
              if (refSnap.exists()) {
                const popData = refSnap.data();
                // Map sub-timestamps
                for (let k in popData) {
                  if (popData[k] && typeof popData[k].toDate === 'function') {
                    popData[k] = popData[k].toDate();
                  }
                }
                item[pop.field] = {
                  _id: refSnap.id,
                  id: refSnap.id,
                  ...popData
                };
              } else {
                item[pop.field] = null;
              }
            }
          }
        }
      }
    }

    // Map final entities to model constructor instances
    const mapped = paginatedResults.map(item => new this.modelClass(item));
    if (this._isFindOne) {
      return mapped.length > 0 ? mapped[0] : null;
    }
    return mapped;
  }

  // Thenable signature so builder can be directly awaited
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

// Base Model mapping Mongoose style ORM queries to Firestore SDK
class FirestoreModel {
  constructor(collectionName, data = {}, id = null) {
    this._collectionName = collectionName;
    this._id = id;
    Object.assign(this, data);
  }

  // Save changes/add document
  async save() {
    const dataToSave = { ...this };
    delete dataToSave._collectionName;
    delete dataToSave._id;

    // Clean up populated objects so we don't save nested data back to Firestore
    for (let key in dataToSave) {
      if (dataToSave[key] && typeof dataToSave[key] === 'object') {
        if (dataToSave[key]._id || dataToSave[key].id) {
          dataToSave[key] = dataToSave[key]._id || dataToSave[key].id;
        }
      }
    }

    // Handle automated timestamps
    const now = new Date();
    if (!this.createdAt && !this.timestamp) {
      if (this._collectionName === 'auditlogs' || this._collectionName === 'verificationlogs') {
        this.timestamp = now;
        dataToSave.timestamp = now;
      } else {
        this.createdAt = now;
        this.updatedAt = now;
        dataToSave.createdAt = now;
        dataToSave.updatedAt = now;
      }
    } else {
      if (this.createdAt) {
        this.updatedAt = now;
        dataToSave.updatedAt = now;
      }
    }

    // Handle password auto-hashing on SuperAdmin/Admin User seeding and updates
    if (this._collectionName === 'users' && this.password && !isBcryptHash(this.password)) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      dataToSave.password = this.password;
    }

    if (this._id) {
      // Update existing document
      const docRef = doc(db, this._collectionName, this._id);
      await setDoc(docRef, dataToSave, { merge: true });
    } else {
      // Create new document
      const colRef = collection(db, this._collectionName);
      const docRef = await addDoc(colRef, dataToSave);
      this._id = docRef.id;
      this.id = docRef.id;
    }

    return this;
  }

  // Static API compatible CRUD wrappers
  static find(queryObj = {}) {
    return new FirestoreQueryBuilder(this.collectionName, this, queryObj);
  }

  static findOne(queryObj = {}) {
    const builder = new FirestoreQueryBuilder(this.collectionName, this, queryObj);
    builder.limit(1);
    builder._isFindOne = true;
    return builder;
  }

  static findById(id) {
    if (!id) {
      return {
        select: function() { return this; }, // stub
        populate: function() { return this; }, // stub
        then: (onFulfilled) => onFulfilled(null)
      };
    }
    const docRef = doc(db, this.collectionName, id.toString());
    
    return {
      select: function() { return this; }, // stub
      populate: function() { return this; }, // stub
      then: (onFulfilled, onRejected) => {
        return getDoc(docRef).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Map dates
            for (let k in data) {
              if (data[k] && typeof data[k].toDate === 'function') {
                data[k] = data[k].toDate();
              }
            }
            return onFulfilled(new this({
              _id: docSnap.id,
              id: docSnap.id,
              ...data
            }));
          }
          return onFulfilled(null);
        }, onRejected);
      }
    };
  }

  static async create(data) {
    const instance = new this(data);
    await instance.save();
    return instance;
  }

  static async insertMany(array) {
    const created = [];
    for (const data of array) {
      const inst = await this.create(data);
      created.push(inst);
    }
    return created;
  }

  static async findOneAndDelete(queryObj) {
    const builder = new FirestoreQueryBuilder(this.collectionName, this, queryObj);
    builder.limit(1);
    const results = await builder.execute();
    if (results.length > 0) {
      const found = results[0];
      const docRef = doc(db, this.collectionName, found._id);
      await deleteDoc(docRef);
      return found;
    }
    return null;
  }

  static async countDocuments(queryObj = {}) {
    const builder = new FirestoreQueryBuilder(this.collectionName, this, queryObj);
    const results = await builder.execute();
    return results.length;
  }

  static async aggregate(pipeline) {
    const builder = new FirestoreQueryBuilder(this.collectionName, this, {});
    const results = await builder.execute();

    let output = results;
    for (const stage of pipeline) {
      if (stage.$group) {
        const idField = stage.$group._id;
        const cleanIdField = idField.startsWith('$') ? idField.substring(1) : idField;
        
        const groups = {};
        for (const item of output) {
          const key = item[cleanIdField] || 'Unknown';
          if (!groups[key]) {
            groups[key] = { _id: key, count: 0 };
          }
          groups[key].count += 1;
        }
        output = Object.values(groups);
      } else if (stage.$sort) {
        const sortField = Object.keys(stage.$sort)[0];
        const order = stage.$sort[sortField];
        output.sort((a, b) => {
          if (a[sortField] < b[sortField]) return order === -1 ? 1 : -1;
          if (a[sortField] > b[sortField]) return order === -1 ? -1 : 1;
          return 0;
        });
      } else if (stage.$limit) {
        output = output.slice(0, stage.$limit);
      }
    }
    
    return output;
  }
}

module.exports = FirestoreModel;
