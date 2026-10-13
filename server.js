const express = require('express');
const connectDB = require('./config/db');
const booksRouter = require('./router/booksRouter');
const membersRouter = require('./router/membersRouter');
const loansRouter = require('./router/loansRouter');

const app = express();

app.use(express.json());

// Connect to the database
connectDB();

app.get('/', async (req, res) => {
    try {
        res.send({ message: 'Welcome to Practical Exam!' });
    } catch (error) {
        res.send({ error: error.message });
    }
});

app.use('/api/books', booksRouter);
app.use('/api/members', membersRouter);
app.use('/api/loans', loansRouter);

const PORT = process.env.PORT || 9999;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));