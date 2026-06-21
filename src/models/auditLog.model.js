const FirestoreModel = require('./firestoreModel');

class AuditLog extends FirestoreModel {
  constructor(data = {}) {
    super('auditlogs', data, data._id || data.id || null);
  }
}

AuditLog.collectionName = 'auditlogs';

module.exports = AuditLog;
