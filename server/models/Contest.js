import mongoose from "mongoose";

const contestSchema = new mongoose.Schema(
    {
        
        cfContestId:{
            type:Number
        },
        name:{
            type:String
        },
        division:{
            type:String,
            enum:["Div1","Div2","Div3","Educational"]
        },
        startTime:{
            type:Date
        },
        durationMinutes:{
            type:Number
        },
        problems:[
            {
                problemIndex:{type:String},
                problem:{type:mongoose.Schema.Types.ObjectId,ref:'Problem'},
            },
        ],
    },{
        timestamps:true
    }
);

contestSchema.index({cfContestId:1},{unique:true});
contestSchema.index({division:1,startTime:1});

export default mongoose.model('Contest',contestSchema);