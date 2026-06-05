import mongoose from "mongoose";

const virtualContestSchema = new mongoose.Schema(
    {
        user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
        cfContestId:{type:Number,required:true},
        scheduledFor:{type:Date,required:true},
        status:{
            type:String,
            enum:['pending','in_progress','completed'],
            default:'pending',
        },
        startedAt:{type:Date},
        completedAt:{type:Date},
        results:[
            {
                problemIndex:{type:String,required:true},
                problem:{type:mongoose.Schema.Types.ObjectId,ref:'Problem',required:true},
                status:{type:String,enum:['solved','failed','unattempted'],required:true},
                firstACTime:{type:Number},
                failCount:{type:Number,default:0},
            },
        ],
        selectionReason:{type:String},
    },
    {timestamps:true}
);

virtualContestSchema.index({user:1,scheduledFor:1});
virtualContestSchema.index({user:1,status:1});

export default mongoose.model('VirtualContest',virtualContestSchema);