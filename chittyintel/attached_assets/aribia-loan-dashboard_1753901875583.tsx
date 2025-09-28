import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Home, AlertTriangle, Calculator, FileText, TrendingUp, Clock, Scale, Menu, X, Gavel, Shield } from 'lucide-react';

const LoanDashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedView, setSelectedView] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Loan details from the documents including November 2024 amendment
  const loanDetails = {
    principal: 100000,
    disbursed: 97060.37, // Corrected amount per June 7, 2024 Credit Memo
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
  };

  // Litigation timeline and details
  const litigationDetails = {
    troFiled: new Date('2024-10-31'),
    troStillActive: true,
    caseNumber: '2024 D 007847',
    court: 'Circuit Court of Cook County - Domestic Relations',
    judge: 'Hon. Robert W. Johnson',
    petitioner: 'Luisa Fernanda Arias Montealegre',
    respondent: 'Nicholas Bianchi',
    operatingAgreementAmended: new Date('2024-10-29'), // Day before TRO
    emergencyMotionFiled: new Date('2025-06-09'),
    troStatutoryLimit: 10, // days
    actualTroDuration: Math.floor((currentDate - new Date('2024-10-31')) / (1000 * 60 * 60 * 24))
  };

  const properties = [
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
  ];

  // Calculate days since first payment was due
  const daysSinceFirstPayment = Math.floor((currentDate - loanDetails.firstPaymentDue) / (1000 * 60 * 60 * 24));
  const monthsOverdue = Math.max(0, Math.floor(daysSinceFirstPayment / 30.44));
  
  // Calculate accumulated interest and penalties
  const dailyInterestRate = loanDetails.interestRate / 100 / 365;
  const accumulatedInterest = loanDetails.principal * dailyInterestRate * Math.max(0, daysSinceFirstPayment);
  const lateFees = monthsOverdue * 60; // $60 per month late
  
  // Calculate current balance
  const currentBalance = loanDetails.principal + accumulatedInterest + lateFees;
  
  // Calculate payoff amounts
  const payoffToday = currentBalance;
  const payoffWithDiscount = currentDate <= loanDetails.discountDeadline 
    ? loanDetails.principal * 0.9 + accumulatedInterest + lateFees 
    : null;

  // Generate accurate payment schedule based on actual amortization table
  const generatePaymentSchedule = () => {
    const schedule = [];
    const amortizationData = [
      { payment: 1, date: new Date('2024-07-01'), principal: 747.07, interest: 388.33, balance: 99252.93 },
      { payment: 2, date: new Date('2024-08-01'), principal: 749.97, interest: 385.43, balance: 98502.96 },
      { payment: 3, date: new Date('2024-09-01'), principal: 752.88, interest: 382.52, balance: 97750.08 },
      { payment: 4, date: new Date('2024-10-01'), principal: 755.80, interest: 379.60, balance: 96994.28 },
      { payment: 5, date: new Date('2024-11-01'), principal: 758.74, interest: 376.66, balance: 96235.54 },
      { payment: 6, date: new Date('2024-12-01'), principal: 761.69, interest: 373.71, balance: 95473.85 },
      { payment: 7, date: new Date('2025-01-01'), principal: 764.64, interest: 370.76, balance: 94709.21 },
      { payment: 8, date: new Date('2025-02-01'), principal: 767.61, interest: 367.79, balance: 93941.60 },
      { payment: 9, date: new Date('2025-03-01'), principal: 770.59, interest: 364.81, balance: 93171.01 },
      { payment: 10, date: new Date('2025-04-01'), principal: 773.59, interest: 361.81, balance: 92397.42 },
      { payment: 11, date: new Date('2025-05-01'), principal: 776.59, interest: 358.81, balance: 91620.83 },
      { payment: 12, date: new Date('2025-06-01'), principal: 779.61, interest: 355.79, balance: 90841.22 }
    ];

    amortizationData.forEach(payment => {
      const isOverdue = payment.date < currentDate;
      const isTroAffected = payment.date >= litigationDetails.troFiled;
      schedule.push({
        paymentNumber: payment.payment,
        date: payment.date,
        amount: loanDetails.monthlyPayment,
        principal: payment.principal,
        interest: payment.interest,
        balance: payment.balance,
        status: isOverdue ? (isTroAffected ? 'suspended-tro' : 'overdue') : 'upcoming',
        isOverdue,
        isTroAffected
      });
    });

    return schedule;
  };

  const paymentSchedule = generatePaymentSchedule();
  const overduePayments = paymentSchedule.filter(p => p.isOverdue);
  const troAffectedPayments = paymentSchedule.filter(p => p.isTroAffected && p.isOverdue);
  const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);

  const StatCard = ({ title, value, subtitle, icon: Icon, color = "blue", alert = false }) => (
    <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${
      alert ? 'border-red-500' : `border-${color}-500`
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-xs font-medium mb-1 ${alert ? 'text-red-600' : 'text-gray-600'}`}>
            {title}
          </p>
          <p className={`text-lg sm:text-xl font-bold ${alert ? 'text-red-900' : 'text-gray-900'}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${alert ? 'text-red-500' : `text-${color}-500`} ml-2`} />
      </div>
    </div>
  );

  const OverviewTab = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* TRO Alert */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
        <div className="flex items-start">
          <Gavel className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-red-800">Active Temporary Restraining Order</h3>
            <p className="text-sm sm:text-base text-red-700 mt-1">
              Case {litigationDetails.caseNumber}: TRO filed {litigationDetails.troFiled.toLocaleDateString()} 
              by {litigationDetails.petitioner} restrains ARIBIA LLC operations. Duration: {litigationDetails.actualTroDuration} days 
              (statutory limit: {litigationDetails.troStatutoryLimit} days).
            </p>
            <p className="text-xs text-red-600 mt-2">
              Emergency Motion to Vacate filed {litigationDetails.emergencyMotionFiled.toLocaleDateString()}.
              Loan payments suspended pending resolution.
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Original Principal"
          value={`$${loanDetails.principal.toLocaleString()}`}
          subtitle="Amount borrowed"
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Current Balance"
          value={`$${Math.round(currentBalance).toLocaleString()}`}
          subtitle="Principal + interest + fees"
          icon={TrendingUp}
          color="orange"
          alert={monthsOverdue > 0}
        />
        <StatCard
          title="TRO Duration"
          value={`${litigationDetails.actualTroDuration}`}
          subtitle={`${Math.round(litigationDetails.actualTroDuration / litigationDetails.troStatutoryLimit * 10) / 10}x statutory limit`}
          icon={Scale}
          alert={true}
        />
        <StatCard
          title="Suspended Payments"
          value={troAffectedPayments.length}
          subtitle={`$${troAffectedPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()} total`}
          icon={Shield}
          alert={troAffectedPayments.length > 0}
        />
      </div>

      {/* Litigation Timeline */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Litigation Timeline</h3>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between border-l-4 border-blue-500 pl-3">
            <span className="text-sm font-medium text-gray-900">Operating Agreement Amendment</span>
            <span className="text-sm text-gray-600">{litigationDetails.operatingAgreementAmended.toLocaleDateString()}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between border-l-4 border-red-500 pl-3">
            <span className="text-sm font-medium text-gray-900">TRO Filed (Domestic Relations)</span>
            <span className="text-sm text-gray-600">{litigationDetails.troFiled.toLocaleDateString()}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between border-l-4 border-yellow-500 pl-3">
            <span className="text-sm font-medium text-gray-900">Loan Amendment Executed</span>
            <span className="text-sm text-gray-600">{loanDetails.amendmentDate.toLocaleDateString()}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between border-l-4 border-green-500 pl-3">
            <span className="text-sm font-medium text-gray-900">Emergency Motion to Vacate Filed</span>
            <span className="text-sm text-gray-600">{litigationDetails.emergencyMotionFiled.toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Legal Case Details */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Legal Case Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm text-gray-600">Case Number:</span>
              <span className="font-medium text-sm">{litigationDetails.caseNumber}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm text-gray-600">Court:</span>
              <span className="font-medium text-sm">{litigationDetails.court}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm text-gray-600">Judge:</span>
              <span className="font-medium text-sm">{litigationDetails.judge}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm text-gray-600">Petitioner:</span>
              <span className="font-medium text-sm break-words">{litigationDetails.petitioner}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm text-gray-600">Respondent:</span>
              <span className="font-medium text-sm">{litigationDetails.respondent}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between">
              <span className="text-sm text-gray-600">TRO Status:</span>
              <span className="font-medium text-sm text-red-600">Active - Beyond Statutory Limit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loan Agreement Details */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Loan Agreement Details</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Lender:</span>
                <span className="font-medium text-sm break-words">{loanDetails.lender}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Borrower:</span>
                <span className="font-medium text-sm">{loanDetails.borrower}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Interest Rate:</span>
                <span className="font-medium text-sm">{loanDetails.interestRate}%</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Monthly Payment:</span>
                <span className="font-medium text-sm">${loanDetails.monthlyPayment}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Late Fee:</span>
                <span className="font-medium text-sm">$60 per month</span>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Original Term:</span>
                <span className="font-medium text-sm">{loanDetails.termMonths} months</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Disbursed Amount:</span>
                <span className="font-medium text-sm">${loanDetails.disbursed.toLocaleString()}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Final Payment Due:</span>
                <span className="font-medium text-sm">{loanDetails.finalPaymentDue.toLocaleDateString()}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Discount Deadline:</span>
                <span className="font-medium text-sm text-orange-600">{loanDetails.discountDeadline.toLocaleDateString()}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <span className="text-sm text-gray-600">Last Amendment:</span>
                <span className="font-medium text-sm">{loanDetails.amendmentDate.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Financial Impact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Accrued Interest</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">${Math.round(accumulatedInterest).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Since loan origination</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Late Fees</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">${lateFees.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{monthsOverdue} months suspended</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Daily Interest Cost</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900">${Math.round(loanDetails.principal * dailyInterestRate).toLocaleString()}</p>
            <p className="text-xs text-gray-500">During TRO suspension</p>
          </div>
        </div>
      </div>

      {/* Payoff Options */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Resolution Options</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="border rounded-lg p-3 sm:p-4">
            <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Full Payoff Today</h4>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">${Math.round(payoffToday).toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Subject to TRO restrictions on asset disposition
            </p>
          </div>
          {payoffWithDiscount && (
            <div className="border rounded-lg p-3 sm:p-4 bg-green-50">
              <h4 className="font-semibold text-green-800 mb-2 text-sm sm:text-base">10% Discount Available</h4>
              <p className="text-xl sm:text-2xl font-bold text-green-800">${Math.round(payoffWithDiscount).toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-green-600 mt-1">
                Valid until {loanDetails.discountDeadline.toLocaleDateString()}
              </p>
              <p className="text-xs text-green-600 mt-2">
                Potential savings: ${Math.round(payoffToday - payoffWithDiscount).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const PaymentsTab = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Payment Schedule (First 12 Payments)</h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentSchedule.map((payment) => (
                  <tr key={payment.paymentNumber} className={
                    payment.status === 'suspended-tro' ? 'bg-red-50' :
                    payment.status === 'overdue' ? 'bg-orange-50' : ''
                  }>
                    <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {payment.paymentNumber}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {payment.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      ${payment.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      ${payment.principal.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      ${payment.interest.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.status === 'suspended-tro' ? 'bg-red-100 text-red-800' :
                        payment.status === 'overdue' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.status === 'suspended-tro' ? 'TRO Suspended' :
                         payment.status === 'overdue' ? 'Overdue' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 rounded-lg">
          <p className="text-xs sm:text-sm text-red-800">
            <strong>TRO Impact:</strong> Temporary Restraining Order filed {litigationDetails.troFiled.toLocaleDateString()} 
            restrains ARIBIA LLC asset disposition and operations. Emergency Motion to Vacate filed {litigationDetails.emergencyMotionFiled.toLocaleDateString()}.
            Interest continues to accrue at 4.66% annually during suspension.
          </p>
        </div>
      </div>
    </div>
  );

  const PropertiesTab = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Collateral Properties Under TRO</h3>
        <div className="space-y-4 sm:space-y-6">
          {properties.map((property, index) => (
            <div key={index} className="border border-red-200 rounded-lg p-3 sm:p-4 bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-2">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base break-words">{property.address}</h4>
                  <div className="space-y-1 sm:space-y-2">
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">Legal:</span> {property.legalDescription}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">PIN:</span> {property.pin}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">Series:</span> {property.series}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">Jones Ownership:</span> 
                      <span className={property.jonesOwnership === '15%' ? 'text-orange-600 font-medium' : ''}> {property.jonesOwnership}</span>
                    </p>
                    <div className="mt-2 p-2 bg-red-100 rounded border-l-4 border-red-400">
                      <p className="text-xs text-red-700">
                        <span className="font-medium">TRO Restriction:</span> {property.troRestriction}
                      </p>
                    </div>
                    {property.jonesOwnership === '15%' && (
                      <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                        Lender holds minority ownership interest in this series
                      </p>
                    )}
                  </div>
                </div>
                <Home className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">Corporate Structure & Jurisdiction</h4>
          <p className="text-xs sm:text-sm text-blue-700 mb-2">
            Ownership transferred to IT CAN BE LLC (Wyoming) on {litigationDetails.operatingAgreementAmended.toLocaleDateString()} 
            - one day before TRO filing. Emergency motion argues Court lacks jurisdiction over non-party business entities.
          </p>
          <p className="text-xs sm:text-sm text-blue-700">
            Operating Agreement requires mandatory arbitration for all disputes. TRO allegedly circumvents proper dispute resolution procedures.
          </p>
        </div>

        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2 text-sm sm:text-base">Loan Security Impact</h4>
          <p className="text-xs sm:text-sm text-yellow-700">
            Both collateral properties are subject to TRO restraints on asset disposition. Loan agreement security provisions may be affected by ongoing litigation regarding ARIBIA LLC ownership and operations.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">ARIBIA LLC Loan Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600">$100,000 Loan Agreement - Operations Under TRO</p>
                <p className="text-xs sm:text-sm text-red-600">Case {litigationDetails.caseNumber}: TRO Day {litigationDetails.actualTroDuration}</p>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm text-gray-500">Current Date</p>
                <p className="font-medium text-sm sm:text-base text-gray-900">{currentDate.toLocaleDateString()}</p>
                <p className="text-xs text-red-600 mt-1">Payments Suspended</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="py-3 sm:py-4">
          <nav className="flex flex-wrap gap-2 sm:gap-4">
            {[
              { id: 'overview', label: 'Overview', icon: DollarSign },
              { id: 'payments', label: 'Payments', icon: Calendar },
              { id: 'properties', label: 'Properties', icon: Home }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedView(id)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedView === id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 mr-1 sm:mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
        {selectedView === 'overview' && <OverviewTab />}
        {selectedView === 'payments' && <PaymentsTab />}
        {selectedView === 'properties' && <PropertiesTab />}
      </div>
    </div>
  );
};

export default LoanDashboard;