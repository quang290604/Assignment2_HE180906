const mongoose = require('mongoose');
const Book = require('../model/books');

const bookFields = ['title', 'author', 'category', 'isbn', 'publishedYear', 'totalCopies', 'availableCopies'];

// Helper function to extract book data from request body
const getBookData = (body) => {
    const data = {};
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const field of bookFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                data[field] = body[field];
            }
        }
    }
    return data;
};

// Error handling function for book operations
const handleBookError = (res, error) => {
    if (error.code === 11000) {
        return res.status(409).json({ message: 'A book with this ISBN already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
};

//GET all books
const getAllBooks = async (req, res) => {
    try {
        const books = await Book.find();
        return res.status(200).json(books);
    } catch (error) {
        return handleBookError(res, error);
    }
};

//GET book by ID
const getBookById = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid book ID' });
    }

    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        return res.status(200).json(book);
    } catch (error) {
        return handleBookError(res, error);
    }
};

//POST create a new book
const createBook = async (req, res) => {
    try {
        const book = new Book(getBookData(req.body));
        await book.save();
        return res.status(201).json({ message: 'Book created successfully', book });
    } catch (error) {
        return handleBookError(res, error);
    }
};

//PUT update a book by ID
const updateBook = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid book ID' });
    }

    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        book.set(getBookData(req.body));
        await book.save();
        return res.status(200).json({ message: 'Book updated successfully', book });
    } catch (error) {
        return handleBookError(res, error);
    }
};

//DELETE a book by ID
const deleteBook = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid book ID' });
    }

    try {
        const book = await Book.findByIdAndDelete(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        return res.status(200).json({ message: 'Book deleted successfully' });
    } catch (error) {
        return handleBookError(res, error);
    }
};

// Exporting the controller functions
module.exports = {
    getAllBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook
};
