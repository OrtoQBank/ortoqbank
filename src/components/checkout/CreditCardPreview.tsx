'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  CreditCardChip,
  CreditCardCvv,
  CreditCardExpiry,
  CreditCardFront,
  CreditCardName,
  CreditCardNumber,
  CreditCardServiceProvider,
} from '@/components/kibo-ui/credit-card';

// Detect card type based on card number
const detectCardType = (cardNumber: string): 'Visa' | 'Mastercard' | 'Amex' | 'Discover' | 'Elo' | 'Diners' | 'Generic' => {
  const cleanNumber = cardNumber.replaceAll(/\s/g, '');
  
  // Visa: starts with 4
  if (/^4/.test(cleanNumber)) {
    return 'Visa';
  }
  
  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(cleanNumber) || /^2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(cleanNumber)) {
    return 'Mastercard';
  }
  
  // Amex: starts with 34 or 37
  if (/^3[47]/.test(cleanNumber)) {
    return 'Amex';
  }
  
  // Discover: starts with 6011, 622126-622925, 644-649, or 65
  if (/^(6011|65|64[4-9]|622)/.test(cleanNumber)) {
    return 'Discover';
  }
  
  // Elo (common in Brazil): starts with specific ranges
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|6504|6505|6516)/.test(cleanNumber)) {
    return 'Elo';
  }
  
  // Diners: starts with 36 or 38
  if (/^3[68]/.test(cleanNumber)) {
    return 'Diners';
  }
  
  return 'Generic';
};

interface CreditCardPreviewProps {
  cardNumber: string;
  cardHolderName: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCvv: string;
}

export function CreditCardPreview({
  cardNumber,
  cardHolderName,
  cardExpiryMonth,
  cardExpiryYear,
  cardCvv,
}: CreditCardPreviewProps) {
  const [cardType, setCardType] = useState<ReturnType<typeof detectCardType>>('Generic');

  // Update card type only when card number changes
  useEffect(() => {
    setCardType(detectCardType(cardNumber));
  }, [cardNumber]);

  return (
    <div className="flex justify-center py-6">
      <CreditCard className="w-full max-w-sm">
        <CreditCardFront className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
          <CreditCardChip className="top-[40%] left-[8%]" />
          <CreditCardNumber className="absolute bottom-[28%] left-0 w-full text-center tracking-wider @xs:text-xl">
            {cardNumber || '•••• •••• •••• ••••'}
          </CreditCardNumber>
          <div className="absolute bottom-[5%] left-0 w-[calc(100%-60px)] px-2 flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <CreditCardName className="text-xs @xs:text-sm">
                {cardHolderName ? cardHolderName.toUpperCase() : 'NOME DO TITULAR'}
              </CreditCardName>
              <CreditCardExpiry className="text-xs @xs:text-sm">
                {cardExpiryMonth && cardExpiryYear
                  ? `${cardExpiryMonth.padStart(2, '0')}/${cardExpiryYear}`
                  : 'MM/AAAA'}
              </CreditCardExpiry>
            </div>
            <div className="flex items-center gap-2">
              <CreditCardCvv className="text-xs @xs:text-sm">
                CVV: {cardCvv || '•••'}
              </CreditCardCvv>
            </div>
          </div>
          {cardType !== 'Generic' && (
            <CreditCardServiceProvider 
              type={cardType} 
              className="absolute bottom-2 right-2 max-w-[50px] max-h-[30px]"
            />
          )}
        </CreditCardFront>
      </CreditCard>
    </div>
  );
}

