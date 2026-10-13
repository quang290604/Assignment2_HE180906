const Book = require('../model/books');
const Loan = require('../model/loans');
const Member = require('../model/members');
const isValidId = (id) => typeof id === 'string' && id.trim().length > 0;

// Helper functions
const populateLoan = (query) => query
    .populate({
        path: 'member_id',
        select: 'fullName email phone membershipType isActive'
    })
    .populate({
        path: 'items.book_id',
        select: 'title author category isbn publishedYear'
    });

// Error handling function    
const handleLoanError = (res, error) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
};

// Function to restore book copies in case of an error during loan creation
const restoreBookCopies = async (reservedBooks) => {
    const errors = [];
    for (const { bookId, quantity } of [...reservedBooks].reverse()) {
        try {
            const result = await Book.updateOne(
                { _id: bookId },
                { $inc: { availableCopies: quantity } }
            );
            if (result.matchedCount !== 1) {
                errors.push(`Could not restore copies for book ${bookId}`);
            }
        } catch (error) {
            errors.push(`Could not restore copies for book ${bookId}: ${error.message}`);
        }
    }
    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }
};

// Function to aggregate loan copies by book ID
const aggregateLoanCopies = (items) => {
    const quantities = new Map();
    for (const item of items) {
        const bookId = item.book_id._id ? item.book_id._id.toString() : item.book_id.toString();
        quantities.set(bookId, (quantities.get(bookId) || 0) + item.quantity);
    }
    return [...quantities].map(([bookId, quantity]) => ({ bookId, quantity }));
};
// Function to handle returning a loan
const returnLoan = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid loan ID' });
    }

    let loan;
    let previousStatus;
    const restoredBooks = [];
    const returnDate = new Date();
    try {
        const existingLoan = await Loan.findById(req.params.id);
        if (!existingLoan) {
            return res.status(404).json({ message: 'Loan record not found' });
        }
        if (existingLoan.status === 'Returned' || existingLoan.returnDate) {
            return res.status(409).json({ message: 'This loan has already been returned' });
        }

        previousStatus = existingLoan.status;
        loan = await Loan.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: 'Returned' }, returnDate: null },
            { $set: { status: 'Returned', returnDate } },
            { new: true, runValidators: true }
        );
        if (!loan) {
            return res.status(409).json({ message: 'This loan has already been returned' });
        }

        for (const { bookId, quantity } of aggregateLoanCopies(loan.items)) {
            const result = await Book.updateOne(
                { _id: bookId },
                { $inc: { availableCopies: quantity } }
            );
            if (result.matchedCount !== 1) {
                const error = new Error(`Could not restore copies for book ${bookId}`);
                error.statusCode = 500;
                throw error;
            }
            restoredBooks.push({ bookId, quantity });
        }

        const populatedLoan = await populateLoan(Loan.findById(loan._id));
        return res.status(200).json({ message: 'Books returned successfully', loan: populatedLoan });
    } catch (error) {
        const rollbackErrors = [];
        for (const { bookId, quantity } of [...restoredBooks].reverse()) {
            try {
                const result = await Book.updateOne(
                    { _id: bookId, availableCopies: { $gte: quantity } },
                    { $inc: { availableCopies: -quantity } }
                );
                if (result.matchedCount !== 1) {
                    rollbackErrors.push(`Could not undo restored copies for book ${bookId}`);
                }
            } catch (rollbackError) {
                rollbackErrors.push(`Could not undo restored copies for book ${bookId}: ${rollbackError.message}`);
            }
        }

        if (loan) {
            try {
                const result = await Loan.updateOne(
                    { _id: loan._id, status: 'Returned', returnDate },
                    { $set: { status: previousStatus, returnDate: null } }
                );
                if (result.matchedCount !== 1) {
                    rollbackErrors.push('Could not restore the loan record status');
                }
            } catch (rollbackError) {
                rollbackErrors.push(`Could not restore the loan record status: ${rollbackError.message}`);
            }
        }

        if (rollbackErrors.length > 0) {
            return res.status(500).json({
                message: 'Returning failed and the operation could not be fully rolled back',
                error: rollbackErrors.join('; ')
            });
        }
        return handleLoanError(res, error);
    }
};

const getAllLoans = async (req, res) => {
    try {
        const loans = await populateLoan(Loan.find());
        return res.status(200).json(loans);
    } catch (error) {
        return handleLoanError(res, error);
    }
};

const getLoanById = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid loan ID' });
    }

    try {
        const loan = await populateLoan(Loan.findById(req.params.id));
        if (!loan) {
            return res.status(404).json({ message: 'Loan record not found' });
        }
        return res.status(200).json(loan);
    } catch (error) {
        return handleLoanError(res, error);
    }
};

const getLoansByMember = async (req, res) => {
    if (!isValidId(req.params.memberId)) {
        return res.status(400).json({ message: 'Invalid member ID' });
    }

    try {
        const memberExists = await Member.exists({ _id: req.params.memberId });
        if (!memberExists) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const loans = await populateLoan(Loan.find({ member_id: req.params.memberId }));
        return res.status(200).json(loans);
    } catch (error) {
        return handleLoanError(res, error);
    }
};

const createLoan = async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ message: 'Request body must be a JSON object' });
    }
    if (!isValidId(body.member_id)) {
        return res.status(400).json({ message: 'A valid member_id is required' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ message: 'At least one book item is required' });
    }
    for (const item of body.items) {
        if (!item || typeof item !== 'object' || Array.isArray(item) || !isValidId(item.book_id)) {
            return res.status(400).json({ message: 'Each item must include a valid book_id' });
        }
        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
            return res.status(400).json({ message: 'Each item quantity must be a positive safe integer' });
        }
    }
    if (body.dueDate === undefined) {
        return res.status(400).json({ message: 'dueDate is required' });
    }

    const reservedBooks = [];
    let loan;
    try {
        const member = await Member.findById(body.member_id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        if (!member.isActive) {
            return res.status(403).json({ message: 'Inactive members cannot borrow books' });
        }

        const requiredCopies = new Map();
        for (const item of body.items) {
            const bookId = item.book_id.toString();
            const quantity = (requiredCopies.get(bookId) || 0) + item.quantity;
            if (!Number.isSafeInteger(quantity)) {
                return res.status(400).json({ message: 'Total quantity for a book exceeds the supported limit' });
            }
            requiredCopies.set(bookId, quantity);
        }

        const bookIds = [...requiredCopies.keys()];
        const books = await Book.find({ _id: { $in: bookIds } }).select('_id availableCopies');
        const booksById = new Map(books.map((book) => [book._id.toString(), book]));
        const missingBookId = bookIds.find((bookId) => !booksById.has(bookId));
        if (missingBookId) {
            return res.status(404).json({ message: `Book not found: ${missingBookId}` });
        }

        for (const [bookId, quantity] of requiredCopies) {
            const availableCopies = booksById.get(bookId).availableCopies || 0;
            if (availableCopies < quantity) {
                return res.status(409).json({ message: `Insufficient copies available for book ${bookId}` });
            }
        }

        for (const [bookId, quantity] of requiredCopies) {
            const reservedBook = await Book.findOneAndUpdate(
                { _id: bookId, availableCopies: { $gte: quantity } },
                { $inc: { availableCopies: -quantity } },
                { new: true }
            );
            if (!reservedBook) {
                const stillExists = await Book.exists({ _id: bookId });
                const error = new Error(stillExists
                    ? `Insufficient copies available for book ${bookId}`
                    : `Book not found: ${bookId}`);
                error.statusCode = stillExists ? 409 : 404;
                throw error;
            }
            reservedBooks.push({ bookId, quantity });
        }

        loan = new Loan({
            member_id: member._id,
            items: body.items.map(({ book_id, quantity }) => ({ book_id, quantity })),
            dueDate: body.dueDate
        });
        await loan.save();
    } catch (error) {
        try {
            await restoreBookCopies(reservedBooks);
        } catch (rollbackError) {
            return res.status(500).json({
                message: 'Borrowing failed and reserved book copies could not be fully restored',
                error: rollbackError.message
            });
        }
        return handleLoanError(res, error);
    }

    try {
        const populatedLoan = await populateLoan(Loan.findById(loan._id));
        return res.status(201).json({ message: 'Loan created successfully', loan: populatedLoan });
    } catch (error) {
        return handleLoanError(res, error);
    }
};

module.exports = {
    getAllLoans,
    getLoanById,
    getLoansByMember,
    createLoan,
    returnLoan
};
