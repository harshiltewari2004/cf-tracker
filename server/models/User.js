import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required:true,
            trim:true
        },
        email:{
            type:String,
            required:true,
            lowercase:true,
            trim:true,
        },
        passwordHash:{
            type:String,
            required:true
        },
        onboardingCompleted:{
            type:Boolean,
            default:false
        },
        onboardingStep:{
            type:Number,
            default:0
        },
        coldStartComplete:{
            type:Boolean,
            default:false
        },
    },
    {
        timestamps:true
    }
);

userSchema.index({email:1},{unique:true});

export default mongoose.model('User',userSchema);