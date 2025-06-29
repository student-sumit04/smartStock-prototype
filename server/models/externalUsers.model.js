import mongoose from 'mongoose';

const externalUserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  companyName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  rating: {
    type: Number,
    enum: [1, 2, 3, 4, 5]
  },
  role: {
    type: String,
    enum: ['supplier', 'transporter'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'inactive'
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ExternalUser = mongoose.model('ExternalUser', externalUserSchema);