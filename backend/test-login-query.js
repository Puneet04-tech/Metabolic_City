import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function testLoginQuery() {
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
    
    // Simulate the login query from auth.js
    const cityCode = 'CITY-IND-BPL8';
    const role = 'operator';
    const staffId = 'OP001';
    
    const query = { cityCode, role, active: true };
    query.staffId = staffId;
    
    console.log('Login query:', query);
    
    const userRecord = await UserModel.findOne(query);
    console.log('User found:', !!userRecord);
    
    if (userRecord) {
      console.log('User details:', {
        email: userRecord.email,
        name: userRecord.name,
        staffId: userRecord.staffId,
        cityCode: userRecord.cityCode,
        role: userRecord.role,
        active: userRecord.active
      });
      
      // Test password verification
      const testPassword = 'password123';
      const isPasswordValid = await bcrypt.compare(testPassword, userRecord.password);
      console.log('Password valid:', isPasswordValid);
    } else {
      console.log('No user found with those credentials');
      
      // Show all users for debugging
      const allUsers = await UserModel.find({});
      console.log('\nAll users in database:');
      allUsers.forEach(u => {
        console.log(`- ${u.email}, Role: ${u.role}, StaffID: ${u.staffId}, City: ${u.cityCode}, Active: ${u.active}`);
      });
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLoginQuery();
