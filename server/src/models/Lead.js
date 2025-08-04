const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  // Lead Status and Temperature
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
    default: 'new',
    index: true
  },
  temperature: {
    type: String,
    enum: ['hot', 'warm', 'cold'],
    default: 'cold',
    index: true
  },
  
  // Company Information
  company: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    industry: {
      type: String,
      trim: true,
      maxlength: [50, 'Industry cannot exceed 50 characters']
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    },
    website: {
      type: String,
      trim: true
    }
  },
  
  // Lead Source and Campaign
  source: {
    type: String,
    enum: ['website', 'social-media', 'email-campaign', 'referral', 'cold-call', 'event', 'advertisement', 'other'],
    default: 'other',
    index: true
  },
  campaign: {
    type: String,
    trim: true,
    maxlength: [100, 'Campaign name cannot exceed 100 characters']
  },
  
  // Financial Information
  estimatedValue: {
    type: Number,
    min: [0, 'Estimated value cannot be negative']
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  
  // Timeline
  expectedCloseDate: {
    type: Date,
    index: true
  },
  lastContactDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  nextFollowUpDate: {
    type: Date,
    index: true
  },
  
  // Location
  location: {
    country: {
      type: String,
      trim: true,
      maxlength: [50, 'Country cannot exceed 50 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [50, 'State cannot exceed 50 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City cannot exceed 50 characters']
    },
    zipCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Zip code cannot exceed 20 characters']
    }
  },
  
  // Engagement and Scoring
  engagementScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  leadScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    index: true
  },
  
  // Additional Information
  notes: [{
    content: {
      type: String,
      required: true,
      maxlength: [1000, 'Note cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      required: true
    }
  }],
  
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  
  // Assignment
  assignedTo: {
    type: String,
    trim: true,
    maxlength: [100, 'Assigned to cannot exceed 100 characters']
  },
  
  // Preferences and Interests
  interests: [{
    type: String,
    trim: true,
    maxlength: [50, 'Interest cannot exceed 50 characters']
  }],
  
  // Communication Preferences
  preferredContactMethod: {
    type: String,
    enum: ['email', 'phone', 'sms', 'linkedin'],
    default: 'email'
  },
  
  // Lead Quality Indicators
  isQualified: {
    type: Boolean,
    default: false,
    index: true
  },
  qualificationCriteria: {
    hasDecisionMakingPower: { type: Boolean, default: false },
    hasBudget: { type: Boolean, default: false },
    hasTimeframe: { type: Boolean, default: false },
    hasNeed: { type: Boolean, default: false }
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1, temperature: 1 });
leadSchema.index({ source: 1, createdAt: -1 });
leadSchema.index({ lastContactDate: -1 });
leadSchema.index({ expectedCloseDate: 1 });
leadSchema.index({ leadScore: -1 });
leadSchema.index({ 'company.industry': 1 });
leadSchema.index({ assignedTo: 1, status: 1 });

// Virtual for full name
leadSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for days since last contact
leadSchema.virtual('daysSinceLastContact').get(function() {
  if (!this.lastContactDate) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.lastContactDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for lead age
leadSchema.virtual('leadAge').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update lead score
leadSchema.pre('save', function(next) {
  // Calculate lead score based on various factors
  let score = 0;
  
  // Temperature scoring
  if (this.temperature === 'hot') score += 40;
  else if (this.temperature === 'warm') score += 25;
  else score += 10;
  
  // Company size scoring
  if (this.company.size) {
    const sizeScores = {
      '1-10': 10,
      '11-50': 15,
      '51-200': 25,
      '201-500': 35,
      '501-1000': 40,
      '1000+': 50
    };
    score += sizeScores[this.company.size] || 0;
  }
  
  // Qualification criteria scoring
  if (this.qualificationCriteria.hasDecisionMakingPower) score += 10;
  if (this.qualificationCriteria.hasBudget) score += 10;
  if (this.qualificationCriteria.hasTimeframe) score += 10;
  if (this.qualificationCriteria.hasNeed) score += 10;
  
  this.leadScore = Math.min(score, 100);
  next();
});

// Static method to get leads by temperature
leadSchema.statics.getLeadsByTemperature = function(temperature, startDate, endDate) {
  const query = { temperature, isActive: true };
  
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to get leads by status
leadSchema.statics.getLeadsByStatus = function(status, startDate, endDate) {
  const query = { status, isActive: true };
  
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method for complex queries
leadSchema.statics.executeQuery = function(mongoQuery) {
  return this.find(mongoQuery).sort({ createdAt: -1 });
};

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
