const Member = require('../model/members');

const memberFields = ['fullName', 'email', 'phone', 'membershipType', 'isActive'];
const isValidId = (id) => typeof id === 'string' && id.trim().length > 0;

const getMemberData = (body) => {
    const data = {};
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const field of memberFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                data[field] = body[field];
            }
        }
    }
    return data;
};

const handleMemberError = (res, error) => {
    if (error.code === 11000) {
        return res.status(409).json({ message: 'A member with this email already exists' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
};

//GET all members
const getAllMembers = async (req, res) => {
    try {
        const members = await Member.find();
        return res.status(200).json(members);
    } catch (error) {
        return handleMemberError(res, error);
    }
};

//GET member by ID
const getMemberById = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid member ID' });
    }

    try {
        const member = await Member.findById(req.params.id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        return res.status(200).json(member);
    } catch (error) {
        return handleMemberError(res, error);
    }
};

//POST create a new member
const createMember = async (req, res) => {
    try {
        const member = new Member(getMemberData(req.body));
        await member.save();
        return res.status(201).json({ message: 'Member created successfully', member });
    } catch (error) {
        return handleMemberError(res, error);
    }
};

//PUT update a member
const updateMember = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid member ID' });
    }

    try {
        const member = await Member.findById(req.params.id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        member.set(getMemberData(req.body));
        await member.save();
        return res.status(200).json({ message: 'Member updated successfully', member });
    } catch (error) {
        return handleMemberError(res, error);
    }
};

//DELETE a member
const deleteMember = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid member ID' });
    }

    try {
        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        return res.status(200).json({ message: 'Member deleted successfully' });
    } catch (error) {
        return handleMemberError(res, error);
    }
};

// Export the controller functions
module.exports = {
    getAllMembers,
    getMemberById,
    createMember,
    updateMember,
    deleteMember
};
