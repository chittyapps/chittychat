export const aribiaData = {
  loanDetails: {
    principal: 100000,
    disbursed: 97060.37,
    interestRate: 4.66,
    monthlyPayment: 1135.40,
    termMonths: 108,
    totalRepayment: 122622.78,
    startDate: new Date('2024-05-28'),
    firstPaymentDue: new Date('2024-07-01'),
    finalPaymentDue: new Date('2033-06-01'),
    discountDeadline: new Date('2029-05-31'),
    discountRate: 0.10,
    lender: 'Sharon Elizabeth Jones',
    borrower: 'ARIBIA LLC',
    amendmentDate: new Date('2024-11-04'),
    litigationStatus: 'TRO restraining business operations'
  },

  litigationDetails: {
    troFiled: new Date('2024-10-31'),
    troStillActive: true,
    caseNumber: '2024 D 007847',
    court: 'Circuit Court of Cook County - Domestic Relations',
    judge: 'Hon. Robert W. Johnson',
    petitioner: 'Luisa Fernanda Arias Montealegre',
    respondent: 'Nicholas Bianchi',
    operatingAgreementAmended: new Date('2024-10-29'),
    emergencyMotionFiled: new Date('2025-06-09'),
    troStatutoryLimit: 10,
    actualTroDuration: Math.floor((new Date().getTime() - new Date('2024-10-31').getTime()) / (1000 * 60 * 60 * 24))
  },

  properties: [
    {
      address: '4343 N Clarendon Ave #1610, Chicago, IL 60613',
      pin: '14616-300-032-1238',
      series: 'ARIBIA LLC - APT ARLENE',
      jonesOwnership: '15%',
      legalDescription: 'Unit 1610 in Boardwalk Condominium',
      troRestriction: 'Asset disposition prohibited except ordinary course'
    },
    {
      address: '550 W Surf St #C211, Chicago, IL 60657',
      pin: '14-28-122-017-1180',
      series: 'ARIBIA LLC - CITY STUDIO',
      jonesOwnership: '0%',
      legalDescription: 'Unit C-211 in Commodore/Greenbrier Landmark Condominium',
      troRestriction: 'Asset disposition prohibited except ordinary course'
    }
  ],

  timelineEvents: [
    {
      id: 1,
      title: 'ARIBIA LLC Formation',
      date: new Date('2022-08-01'),
      description: 'Operating Agreement executed with initial members',
      type: 'formation',
      color: 'green'
    },
    {
      id: 2,
      title: 'Member Temporary Exit',
      date: new Date('2023-05-09'),
      description: 'Sharon Jones temporary exit for international compliance',
      type: 'member',
      color: 'amber'
    },
    {
      id: 3,
      title: 'Member Readmission',
      date: new Date('2024-03-15'),
      description: 'Sharon reinstated as 5% member via unanimous consent',
      type: 'member',
      color: 'blue'
    },
    {
      id: 4,
      title: '$100K Loan Agreement',
      date: new Date('2024-05-27'),
      description: 'Promissory Note executed with 4.66% interest rate',
      type: 'financial',
      color: 'purple'
    },
    {
      id: 5,
      title: 'Ownership Transfer',
      date: new Date('2024-10-29'),
      description: 'Transfer to IT CAN BE LLC as sole owner',
      type: 'ownership',
      color: 'red'
    }
  ],

  financialData: {
    capitalContributions: [
      { date: 'Aug 2022', amount: 120000 },
      { date: 'Dec 2022', amount: 150000 },
      { date: 'May 2023', amount: 180000 },
      { date: 'Mar 2024', amount: 220000 },
      { date: 'May 2024', amount: 280000 },
      { date: 'Oct 2024', amount: 302947 }
    ],
    outstandingObligations: [
      { date: 'Aug 2022', amount: 0 },
      { date: 'Dec 2022', amount: 5000 },
      { date: 'May 2023', amount: 8000 },
      { date: 'Mar 2024', amount: 12000 },
      { date: 'May 2024', amount: 100000 },
      { date: 'Oct 2024', amount: 95000 }
    ]
  }
};
