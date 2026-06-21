const { db } = require('./firebase');
const User = require('./models/user.model');

const connectDB = async () => {
  try {
    console.log('Firebase Firestore connection established successfully.');
    
    // Seed default admin account in Firestore
    await seedDefaultAdmin();
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
  }
};

const seedDefaultAdmin = async () => {
  try {
    const email = 'santhoshmass252@gmail.com';
    const adminExists = await User.findOne({ email });
    
    if (!adminExists) {
      const defaultPassword = 'santhoshs2011';
      await User.create({
        username: 'SanthoshKumar',
        email: email,
        password: defaultPassword,
        role: 'SuperAdmin',
        permissions: ['issue_certificate', 'revoke_certificate', 'delete_certificate', 'manage_users', 'verify_certificate'],
        isActive: true
      });
      console.log('----------------------------------------');
      console.log('Seeded Default SuperAdmin Account in Firestore:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${defaultPassword}`);
      console.log('----------------------------------------');
    } else {
      const defaultPassword = 'santhoshs2011';
      adminExists.password = defaultPassword; // Save hook hashes if needed
      await adminExists.save();
      console.log('----------------------------------------');
      console.log('Verified/Updated SuperAdmin Account in Firestore:');
      console.log(`Email: ${email}`);
      console.log('----------------------------------------');
    }
  } catch (err) {
    console.error('Failed to seed default admin in Firestore:', err.message);
  }
};

module.exports = connectDB;
