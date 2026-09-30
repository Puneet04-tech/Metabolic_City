import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function resetOperatorUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/metabolic_city');
    console.log('Connected to MongoDB');

    // Define the User schema
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
    
    // Delete existing operator with OP001
    console.log('Deleting existing operator with Staff ID OP001...');
    await UserModel.deleteOne({ 
      cityCode: 'CITY-IND-BPL8',
      role: 'operator',
      staffId: 'OP001'
    });
    
    // Create new operator with fresh credentials
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const userData = {
      name: 'Admin Operator',
      email: 'admin@muni.com',
      password: hashedPassword,
      cityCode: 'CITY-IND-BPL8',
      jurisdiction: 'CITY-IND-BPL8',
      role: 'operator',
      organization: 'Metabolic City',
      staffId: 'OP001',
      active: true,
    };

    const user = await UserModel.create(userData);
    console.log('New operator created successfully');
    
    console.log('\n=== NEW LOGIN CREDENTIALS ===');
    console.log('Full Name:', userData.name);
    console.log('Email:', userData.email);
    console.log('Role:', userData.role);
    console.log('Staff ID:', userData.staffId);
    console.log('City Code:', userData.cityCode);
    console.log('Password: Admin@123');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetOperatorUser();
