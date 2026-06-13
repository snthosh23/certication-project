const mongoose = require('mongoose');
const User = require('./models/user.model');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/certificate_system', {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Seed default admin account
    await seedDefaultAdmin();
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    // Do not crash the process in development, but print warning
    console.warn('Proceeding without MongoDB. Ensure MongoDB is running locally or check MONGODB_URI in your .env file.');
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
      console.log('Seeded Default SuperAdmin Account:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${defaultPassword}`);
      console.log('----------------------------------------');
    } else {
      // Reset/Update password for development seed alignment
      const defaultPassword = 'santhoshs2011';
      adminExists.password = defaultPassword; // Pre-save hook will hash it
      await adminExists.save();
      console.log('----------------------------------------');
      console.log('Updated Existing SuperAdmin Password:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${defaultPassword}`);
      console.log('----------------------------------------');
    }
  } catch (err) {
    console.error('Failed to seed default admin:', err.message);
  }
};

module.exports = connectDB;
