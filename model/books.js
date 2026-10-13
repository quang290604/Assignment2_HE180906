const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString()
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    isbn: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    publishedYear: {
        type: Number
    },
    totalCopies: {
        type: Number,
        min: 0
    },
    availableCopies: {
        type: Number,
        min: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);