import mongoose from "mongoose";

const cfProfileSchema = new mongoose.Schema(
    {
        user:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User',
            required:true
        },
        handle:{
            type:String,
            required:true
        },
        currentRating:{
            type:Number
        },
        maxRating:{
            type:Number
        },
        rank:{
            type:String
        },
        lastIngestedSubmissionId:{
            type:String
        },
        ingestStatus:{
            type:String,
            enum:['pending','processing','complete','failed'],
            default:'pending',
        },
        ingestCompletedAt:{
            type:Date
        },
        lastSyncedAt:{
            type:Date
        }
    },
    {
        timestamps:true
    }
);

cfProfileSchema.index({user:1},{unique:true});
cfProfileSchema.index({handle:1},{unique:true});

export default mongoose.model('CFProfile',cfProfileSchema);