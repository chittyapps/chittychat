import { LucideIcon, ArrowUp, ShieldCheck, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface AnalyticsCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  data: any[];
  footerText: string;
  footerIcon: string;
  footerColor: string;
  isStatusCard?: boolean;
  isAssetCard?: boolean;
}

export function AnalyticsCard({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  data,
  footerText,
  footerIcon,
  footerColor,
  isStatusCard = false,
  isAssetCard = false
}: AnalyticsCardProps) {
  
  const getFooterIcon = () => {
    switch (footerIcon) {
      case 'arrow-up':
        return <ArrowUp size={12} />;
      case 'shield-check':
        return <ShieldCheck size={12} />;
      case 'trending-up':
        return <TrendingUp size={12} />;
      default:
        return <ArrowUp size={12} />;
    }
  };

  const getStatusBadge = (status: string, color: string) => {
    const colorMap: Record<string, string> = {
      green: 'bg-green-100 text-green-800',
      blue: 'bg-blue-100 text-blue-800',
      amber: 'bg-amber-100 text-amber-800',
      purple: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`text-xs ${colorMap[color]} px-2 py-1 rounded-full`}>
        {status}
      </span>
    );
  };

  const getStatusIndicator = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      amber: 'bg-amber-500',
      purple: 'bg-purple-500'
    };
    
    return <div className={`w-2 h-2 ${colorMap[color]} rounded-full`}></div>;
  };

  return (
    <div className="bg-white rounded-3xl p-6 card-shadow smooth-hover hover:shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={iconColor} size={16} />
        </div>
      </div>
      
      <div className="space-y-4">
        {data.map((item, index) => (
          <motion.div
            key={index}
            className={`flex ${isStatusCard || isAssetCard ? 'items-center justify-between' : 'justify-between items-center'} p-3 ${item.bg || 'bg-gray-50'} rounded-xl`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            {isStatusCard ? (
              <>
                <div className="flex items-center">
                  {getStatusIndicator(item.color)}
                  <span className="text-sm font-medium text-gray-700 ml-3">{item.label}</span>
                </div>
                {getStatusBadge(item.status, item.color)}
              </>
            ) : isAssetCard ? (
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{item.status}</span>
                </div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
            ) : (
              <>
                <span className={`text-sm font-medium ${item.textColor || 'text-gray-700'}`}>{item.label}</span>
                <span className={`text-sm font-bold ${item.textColor?.replace('700', '800') || 'text-gray-900'}`}>{item.value}</span>
              </>
            )}
          </motion.div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className={`flex items-center ${footerColor}`}>
          {getFooterIcon()}
          <span className="text-sm font-medium ml-2">{footerText}</span>
        </div>
      </div>
    </div>
  );
}
