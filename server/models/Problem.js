import mongoose from "mongoose";

const problemSchema = new mongoose.Schema(
    {
        cfContestId:{
            type:Number
        },
        cfIndex:{
            type:String
           
        },
        name:{
            type:String
        },
        tags:[String],
        ratingBucket:{
            type:String
        },
        rating:{
            type:Number
        },
        url:{
            type:String
        },
        isDiv2A:{
            type:Boolean
        },
        isDiv2B:{
            type:Boolean
        }
    },
    {
        timestamps:true
    }
);

problemSchema.index({cfContestId:1,cfIndex:1},{unique:true});
problemSchema.index({ratingBucket:1,tags:1});
problemSchema.index({rating:1});

export default mongoose.model('Problem',problemSchema);