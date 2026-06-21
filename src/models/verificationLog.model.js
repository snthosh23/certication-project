const FirestoreModel = require('./firestoreModel');

class VerificationLog extends FirestoreModel {
  constructor(data = {}) {
    super('verificationlogs', data, data._id || data.id || null);
  }
}

VerificationLog.collectionName = 'verificationlogs';

module.exports = VerificationLog;
