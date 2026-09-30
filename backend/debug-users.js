import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function debugUsers() {
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
    
    // Find all operators in CITY-IND-BPL8
    const operators = await UserModel.find({ 
      cityCode: 'CITY-IND-BPL8',
      role: 'operator'
    });
    
    console.log(`Found ${operators.length} operators in CITY-IND-BPL8:`);
    operators.forEach(op => {
      console.log(`\n- Name: ${op.name}`);
      console.log(`  Email: ${op.email}`);
      console.log(`  Staff ID: ${op.staffId}`);
      console.log(`  Active: ${op.active}`);
      console.log(`  Has Password: ${!!op.password}`);
    });

    // Specifically check for OP001
    const op001 = await UserModel.findOne({ 
      cityCode: 'CITY-IND-BPL8',
      role: 'operator',
      staffId: 'OP001'
    });
    
    if (op001) {
      console.log('\n\n=== OP001 USER DETAILS ===');
      console.log('Name:', op001.name);
      console.log('Email:', op001.email);
      console.log('Staff ID:', op001.staffId);
      console.log('Active:', op001.active);
      
      // Test password with common passwords
      const testPasswords = ['password123', 'admin123', '12345678', 'admin'];
      for (const pwd of testPasswords) {
        try {
          const isValid = await bcrypt.compare(pwd, op001.password);
          console.log(`Password "${pwd}": ${isValid ? 'VALID ✓' : 'INVALID ✗'}`);
        } catch (e) {
          console.log(`Password "${pwd}": ERROR checking`);
        }
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugUsers();
