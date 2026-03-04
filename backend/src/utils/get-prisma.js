const { prisma: basePrisma } = require('../db/prisma');

const getPrisma = (req) => req.prisma || basePrisma;

module.exports = { getPrisma };

