const express = require('express');
const loansController = require('../controller/loansController');

const router = express.Router();

router.get('/member/:memberId', loansController.getLoansByMember);
router.put('/:id/return', loansController.returnLoan);
router.get('/', loansController.getAllLoans);
router.get('/:id', loansController.getLoanById);
router.post('/', loansController.createLoan);

module.exports = router;