const FirestoreModel = require('./firestoreModel');

class Certificate extends FirestoreModel {
  constructor(data = {}) {
    super('certificates', data, data._id || data.id || null);
  }
}

Certificate.collectionName = 'certificates';

module.exports = Certificate;
