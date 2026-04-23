import React from 'react';
import { Button } from './ui/button';
import { UserPlus, Bot, PhoneForwarded  } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';

interface CallTransferControlProps {
  callId: number;
  onTransferToAI: () => void;
  onTransferToHuman: (agentId: string) => void;
}

export const CallTransferControl: React.FC<CallTransferControlProps> = ({
  onTransferToAI,
  onTransferToHuman
}) => {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <PhoneForwarded className="h-4 w-4" />
            Transférer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Options de transfert</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onTransferToAI} className="gap-2 cursor-pointer">
            <Bot className="h-4 w-4 text-blue-500" />
            <span>Transférer à l'IA</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase">Agents disponibles</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => onTransferToHuman('1')} className="gap-2 cursor-pointer">
            <UserPlus className="h-4 w-4 text-green-500" />
            <span>Jean Dupont (Support)</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => onTransferToHuman('2')} className="gap-2 cursor-pointer">
            <UserPlus className="h-4 w-4 text-green-500" />
            <span>Marie Curie (Ventes)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
