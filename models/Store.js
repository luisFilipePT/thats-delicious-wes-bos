const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: 'Please enter a store!'
    },
    slug: String,
    description: {
        type: String,
        trim: true
    },
    tags: [String],
    created: {
        type: Date,
        default: Date.now
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: 'You must supply coordinates'
        }],
        address: {
            type: String,
            required: 'You must supply and address'
        }
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply an author'
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// define indexes
storeSchema.index({
    name: 'text',
    description: 'text'
});

storeSchema.index({
    location: '2dsphere',
});

storeSchema.pre('save', function (next) {
    if (!this.isModified('name')) {
        return next(); // skip stop the rest from running
    }
    this.slug = slug(this.name);
    next();
    // TODO unique slugs
});

storeSchema.statics.getTagsList = function () {
    return this.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);
};

storeSchema.statics.getTopStores = function () {
    return this.aggregate([
        // Lookup stores and populate their reviews
        {
            $lookup: {
                from: 'reviews',
                localField: '_id',
                foreignField: 'store',
                as: 'reviews'
            }
        },
        // Filter for only items that have two or more reviews
        {
            $match: {
                'reviews.1': { $exists: true }
            }
        },
        // Add the average reviews field
        {
            $addFields: {
                averageRating: {
                    $avg: '$reviews.rating'
                }
            }
        },
        // Sort it by our new field, highest reviews first
        {
            $sort: { averageRating: -1 }
        },
        // Limit to at most 10 results
        { $limit: 10 }
    ]);
};

// find reviews where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
    ref: 'Review', // what model to link
    localField: '_id', // which field on the store
    foreignField: 'store' // which field on the review
});

function autopopulate(next) {
    this.populate('reviews');
    next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);