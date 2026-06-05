import mongoose, { version } from "mongoose";

const benchmarkCohortSchema = new mongoose.Schema(
    {
        filters:{
            country:{type:String,default:'IN'},
            minRating:{type:Number,default:1300},
            maxRating:{type:Number,default:1500},
            minContests:{type:Number,default:30},
            minSolves:{type:Number,default:500},
            lastContestWithinDays:{type:Number,default:180},
        },
        users:[
            {
                handle:{type:String,required:true},
                currentRating:{type:Number},
                contestCount:{type:Number},
                solveCount:{type:Number},
                lastContestDate:{type:Date},
            },
        ],
        N:{
            type:Number,
            required:true,
        },
        fallBackUsed:{
            type:String,
            enum:['1300-1700_IN','1300-1500_global','1300-1700_global'],
            default:null,
        },
        lastRefreshed:{type:Date,default:Date.now},
        version:{type:Number,required:true},
    },
    {
        timestamps:true,
    }
);

benchmarkCohortSchema.index({version:-1});

export default mongoose.model('BenchmarkCohort',benchmarkCohortSchema);