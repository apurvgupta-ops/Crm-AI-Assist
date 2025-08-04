require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');

const sampleLeads = [
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@techcorp.com',
    phone: '+1234567890',
    temperature: 'hot',
    status: 'qualified',
    company: {
      name: 'TechCorp Solutions',
      industry: 'Technology',
      size: '201-500',
      website: 'https://techcorp.com'
    },
    source: 'website',
    campaign: 'Q4 Enterprise Campaign',
    estimatedValue: 75000,
    budget: 85000,
    expectedCloseDate: new Date('2024-12-15'),
    location: {
      country: 'United States',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94105'
    },
    assignedTo: 'Sarah Johnson',
    interests: ['CRM Software', 'Sales Automation'],
    preferredContactMethod: 'email',
    isQualified: true,
    qualificationCriteria: {
      hasDecisionMakingPower: true,
      hasBudget: true,
      hasTimeframe: true,
      hasNeed: true
    },
    notes: [
      {
        content: 'Initial discovery call completed. Strong interest in our enterprise solution.',
        createdBy: 'Sarah Johnson',
        createdAt: new Date('2024-07-15')
      }
    ],
    tags: ['enterprise', 'high-priority']
  },
  {
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@startupx.io',
    phone: '+1987654321',
    temperature: 'warm',
    status: 'contacted',
    company: {
      name: 'StartupX',
      industry: 'E-commerce',
      size: '11-50',
      website: 'https://startupx.io'
    },
    source: 'social-media',
    campaign: 'SMB LinkedIn Campaign',
    estimatedValue: 15000,
    budget: 20000,
    expectedCloseDate: new Date('2024-11-30'),
    location: {
      country: 'United States',
      state: 'New York',
      city: 'New York',
      zipCode: '10001'
    },
    assignedTo: 'Mike Chen',
    interests: ['E-commerce Tools', 'Customer Analytics'],
    preferredContactMethod: 'phone',
    isQualified: false,
    qualificationCriteria: {
      hasDecisionMakingPower: false,
      hasBudget: true,
      hasTimeframe: false,
      hasNeed: true
    },
    notes: [
      {
        content: 'Responded to LinkedIn outreach. Needs to discuss with team.',
        createdBy: 'Mike Chen',
        createdAt: new Date('2024-07-20')
      }
    ],
    tags: ['startup', 'e-commerce']
  },
  {
    firstName: 'Robert',
    lastName: 'Wilson',
    email: 'robert.wilson@manufacturing.com',
    phone: '+1555123456',
    temperature: 'cold',
    status: 'new',
    company: {
      name: 'Wilson Manufacturing',
      industry: 'Manufacturing',
      size: '501-1000',
      website: 'https://wilsonmfg.com'
    },
    source: 'cold-call',
    estimatedValue: 45000,
    location: {
      country: 'United States',
      state: 'Texas',
      city: 'Houston',
      zipCode: '77001'
    },
    assignedTo: 'Lisa Rodriguez',
    interests: ['Process Optimization'],
    preferredContactMethod: 'email',
    isQualified: false,
    qualificationCriteria: {
      hasDecisionMakingPower: true,
      hasBudget: false,
      hasTimeframe: false,
      hasNeed: false
    },
    tags: ['manufacturing', 'cold-lead']
  },
  {
    firstName: 'Amanda',
    lastName: 'Thompson',
    email: 'amanda.thompson@healthtech.com',
    phone: '+1444555666',
    temperature: 'hot',
    status: 'proposal',
    company: {
      name: 'HealthTech Innovations',
      industry: 'Healthcare',
      size: '51-200',
      website: 'https://healthtech.com'
    },
    source: 'referral',
    campaign: 'Healthcare Referral Program',
    estimatedValue: 95000,
    budget: 100000,
    expectedCloseDate: new Date('2024-10-15'),
    location: {
      country: 'United States',
      state: 'Massachusetts',
      city: 'Boston',
      zipCode: '02101'
    },
    assignedTo: 'David Park',
    interests: ['Healthcare CRM', 'Patient Management'],
    preferredContactMethod: 'phone',
    isQualified: true,
    qualificationCriteria: {
      hasDecisionMakingPower: true,
      hasBudget: true,
      hasTimeframe: true,
      hasNeed: true
    },
    notes: [
      {
        content: 'Proposal sent. Very interested in our healthcare-specific features.',
        createdBy: 'David Park',
        createdAt: new Date('2024-07-25')
      },
      {
        content: 'Follow-up call scheduled for next week.',
        createdBy: 'David Park',
        createdAt: new Date('2024-07-28')
      }
    ],
    tags: ['healthcare', 'proposal-sent', 'high-value']
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.brown@retailchain.com',
    phone: '+1333444555',
    temperature: 'warm',
    status: 'negotiation',
    company: {
      name: 'Retail Chain Plus',
      industry: 'Retail',
      size: '1000+',
      website: 'https://retailchainplus.com'
    },
    source: 'event',
    campaign: 'Trade Show 2024',
    estimatedValue: 150000,
    budget: 175000,
    expectedCloseDate: new Date('2024-09-30'),
    location: {
      country: 'United States',
      state: 'Illinois',
      city: 'Chicago',
      zipCode: '60601'
    },
    assignedTo: 'Jennifer Wu',
    interests: ['Retail Analytics', 'Inventory Management'],
    preferredContactMethod: 'email',
    isQualified: true,
    qualificationCriteria: {
      hasDecisionMakingPower: true,
      hasBudget: true,
      hasTimeframe: true,
      hasNeed: true
    },
    notes: [
      {
        content: 'Met at retail expo. Very interested in multi-location features.',
        createdBy: 'Jennifer Wu',
        createdAt: new Date('2024-06-15')
      },
      {
        content: 'Contract negotiation in progress. Discussing implementation timeline.',
        createdBy: 'Jennifer Wu',
        createdAt: new Date('2024-07-30')
      }
    ],
    tags: ['retail', 'enterprise', 'negotiation']
  },
  {
    firstName: 'Sarah',
    lastName: 'Martinez',
    email: 'sarah.martinez@consulting.biz',
    phone: '+1777888999',
    temperature: 'cold',
    status: 'new',
    company: {
      name: 'Martinez Consulting',
      industry: 'Consulting',
      size: '1-10',
      website: 'https://martinezconsulting.biz'
    },
    source: 'advertisement',
    estimatedValue: 8000,
    budget: 12000,
    location: {
      country: 'United States',
      state: 'Florida',
      city: 'Miami',
      zipCode: '33101'
    },
    assignedTo: 'Tom Anderson',
    interests: ['Small Business Tools'],
    preferredContactMethod: 'phone',
    isQualified: false,
    qualificationCriteria: {
      hasDecisionMakingPower: true,
      hasBudget: false,
      hasTimeframe: false,
      hasNeed: true
    },
    tags: ['small-business', 'consulting']
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    // Clear existing leads (optional - comment out if you want to preserve existing data)
    await Lead.deleteMany({});
    logger.info('Cleared existing leads');

    // Insert sample leads
    const createdLeads = await Lead.insertMany(sampleLeads);
    logger.info(`Successfully seeded ${createdLeads.length} leads`);

    // Log summary
    const counts = await Lead.aggregate([
      {
        $group: {
          _id: '$temperature',
          count: { $sum: 1 }
        }
      }
    ]);

    logger.info('Lead breakdown:');
    counts.forEach(item => {
      logger.info(`  ${item._id}: ${item.count} leads`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeder if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, sampleLeads };
