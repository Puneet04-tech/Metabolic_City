import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    cityCode: { type: String, required: true },
    role: { type: String, enum: ['operator', 'field_crew', 'administrator'], required: true },
    jurisdiction: { type: String },
    staffId: { type: String, sparse: true },
    phone: { type: String, sparse: true },
    adminId: { type: String, sparse: true },
    password: { type: String, required: true, select: false },
    organization: { type: String, default: 'Metabolic City' },
  },
  { timestamps: true }
);

// Ensure unique indexes for role-specific fields
userSchema.index({ cityCode: 1, role: 1, staffId: 1 }, { sparse: true, unique: true });
userSchema.index({ cityCode: 1, role: 1, phone: 1 }, { sparse: true, unique: true });
userSchema.index({ cityCode: 1, role: 1, adminId: 1 }, { sparse: true, unique: true });

const UserModel = mongoose.model('User', userSchema);

export const User = {
  async findOne(query = {}) {
    try {
      const user = await UserModel.findOne(query).select('+password');
      if (!user) return null;

      const userObj = user.toObject();
      return {
        ...userObj,
        select: (selectValue) => {
          if (!selectValue || selectValue === '+password') {
            return userObj;
          }
          const copy = { ...userObj };
          delete copy.password;
          return copy;
        },
      };
    } catch (error) {
      console.error('User.findOne error:', error);
      return null;
    }
  },

  async findById(id) {
    try {
      const user = await UserModel.findById(id);
      return user ? user.toObject() : null;
    } catch (error) {
      console.error('User.findById error:', error);
      return null;
    }
  },

  async create(data) {
    try {
      const user = await UserModel.create(data);
      return user.toObject();
    } catch (error) {
      console.error('User.create error:', error);
      throw error;
    }
  },
};
