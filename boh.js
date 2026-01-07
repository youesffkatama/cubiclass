// create_admin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// --- CONFIGURATION: CHANGE THESE VALUES ---
const NEW_USER = {
    email: "admin@scholar.ai",
    password: "password123",
    username: "AdminUser"
};
// ------------------------------------------

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ Connection Error:', err);
        process.exit(1);
    }
};

// Define Schema (Simplified version of your server.js User model)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    dna: { 
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        rank: { type: String, default: 'Novice' },
        streakDays: { type: Number, default: 0 }
    },
    settings: {
        theme: { type: String, default: 'dark' },
        notifications: { type: Boolean, default: true }
    },
    profile: {
        firstName: { type: String, default: 'Admin' },
        lastName: { type: String, default: 'User' },
        avatar: { type: String, default: '' }
    }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const createAdmin = async () => {
    await connectDB();

    try {
        // 1. Check if user exists
        const existingUser = await User.findOne({ email: NEW_USER.email });
        if (existingUser) {
            console.log('⚠️  User already exists!');
            process.exit(0);
        }

        // 2. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(NEW_USER.password, salt);

        // 3. Create the user
        const user = new User({
            username: NEW_USER.username,
            email: NEW_USER.email,
            passwordHash: hashedPassword,
            profile: {
                avatar: `https://ui-avatars.com/api/?name=${NEW_USER.username}&background=00ed64&color=001e2b`
            }
        });

        await user.save();
        console.log(`🎉 User created successfully!`);
        console.log(`📧 Email: ${NEW_USER.email}`);
        console.log(`🔑 Password: ${NEW_USER.password}`);

    } catch (error) {
        console.error('❌ Error creating user:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

createAdmin();