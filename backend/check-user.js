import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkUser() {
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
    
    // Check for the test user
    const user = await UserModel.findOne({ email: 'operator@test.com' });
    
    if (user) {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('Role:', user.role);
      console.log('City Code:', user.cityCode);
      console.log('Staff ID:', user.staffId);
      console.log('Active:', user.active);
      console.log('Password exists:', !!user.password);
    } else {
      console.log('User not found!');
    }

    // Check all operator users
    const allOperators = await UserModel.find({ role: 'operator' });
    console.log('\nAll operator users in database:', allOperators.length);
    allOperators.forEach(op => {
      console.log(`- ${op.name} (${op.email}), Staff ID: ${op.staffId}, Active: ${op.active}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
