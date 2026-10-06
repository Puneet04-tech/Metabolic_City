import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './src/models/User.js';

dotenv.config({ path: '.env' });

async function checkOperator() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const operator = await User.findOne({ role: 'operator' });

    if (operator) {
      console.log('\nOperator Details:');
      console.log('Staff ID:', operator.staffId);
      console.log('Email:', operator.email);
      console.log('Name:', operator.name);
      console.log('Role:', operator.role);
      console.log('Active:', operator.active);
    } else {
      console.log('No operator found in database');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkOperator();
