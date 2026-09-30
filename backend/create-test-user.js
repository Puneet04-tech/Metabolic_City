import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const userData = {
      name: 'Test Operator',
      email: 'operator@test.com',
      password: hashedPassword,
      cityCode: 'CITY-IND-BPL8',
      jurisdiction: 'CITY-IND-BPL8',
      role: 'operator',
      organization: 'Metabolic City',
      staffId: 'OP001',
      active: true,
    };

    // Define the User schema inline to avoid model conflicts
    const userSchema = new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      cityCode: { type: String, required: true },
      role: { type: String, enum: ['operator', 'field_crew', 'administrator'], required: true },
      jurisdiction: { type: String },
      staffId: { type: String, sparse: true },
      phone: { type: String, sparse: true },
      adminId: { type: String, sparse: true },
      password: { type: String, required: true },
      organization: { type: String, default: 'Metabolic City' },
      active: { type: Boolean, default: true },
    }, { timestamps: true });

    const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
    
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: userData.email });
    if (existingUser) {
      console.log('User already exists. Deleting and recreating...');
      await UserModel.deleteOne({ email: userData.email });
      const user = await UserModel.create(userData);
      console.log('User recreated successfully');
    } else {
      const user = await UserModel.create(userData);
      console.log('Test user created successfully');
    }

    console.log('\nLogin credentials:');
    console.log('Email:', userData.email);
    console.log('Password: password123');
    console.log('Role: operator');
    console.log('Staff ID:', userData.staffId);
    console.log('City Code:', userData.cityCode);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();
