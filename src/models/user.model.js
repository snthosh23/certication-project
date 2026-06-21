const FirestoreModel = require('./firestoreModel');
const bcrypt = require('bcryptjs');

class User extends FirestoreModel {
  constructor(data = {}) {
    super('users', data, data._id || data.id || null);
  }

  async comparePassword(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  }
}

User.collectionName = 'users';

module.exports = User;
