import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { BCRYPT_COST_FACTOR } from '../config/constants.js';

export const hashPassword = async (plainPassword)=>{
    return bcrypt.hash(plainPassword,BCRYPT_COST_FACTOR);
};

export const comparePassword = async (plainPassword,passwordHash)=>{
    return bcrypt.compare(plainPassword,passwordHash);
};

export const signToken = (userId)=>{
    return jwt.sign({ userId },env.JWT_SECRET,{expiresIn:env.JWT_EXPIRES_IN});
};

export const verifyToken = (token) =>{
    return jwt.verify(token,env.JWT_SECRET);
};