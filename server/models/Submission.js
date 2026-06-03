import mongoose from "mongoose";

const submissionSchema=new mongoose.Schema(
    {
        user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
        problem:{type:mongoose.Schema.Types.ObjectId,ref:'Problem',required:true},
        cfSubmissionId:{type:Number,required:true},
        verdict:{type:String,enum:["OK","WA","TLE","RE","MLE"]},
        participantType:{type:String,enum:["CONTESTANT","VIRTUAL","PRACTICE"]},
        cfContestId:{type:Number},
        timeConsumed:{type:Number},
        language:{type:String},
        submittedAt:{type:Date}
    },
    {timestamps:true}
);

submissionSchema.index({user:1,cfSubmissionId:1},{unique:true});
submissionSchema.index({user:1,problem:1});
submissionSchema.index({user:1,submittedAt:1});
submissionSchema.index({user:1,participantType:1,verdict:1});

export default mongoose.model('Submission',submissionSchema);