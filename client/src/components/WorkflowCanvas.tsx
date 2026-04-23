/**
 * WORKFLOW CANVAS COMPONENT (BLOC 4)
 * Visualisation no-code interactive pour l'éditeur de workflow
 */

import React from "react";
import { Zap, 
  ArrowDown, 
  Plus, 
  GripVertical, 
  Trash2,
  Settings2,
  LayoutGrid
 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface WorkflowMetadata {
  value: string;
  label: string;
  icon?: any;
}

interface WorkflowCanvasProps {
  workflow: {
    name: string;
    trigger: string;
    triggerType?: string;
    actions: WorkflowAction[];
  };
  actionsMetadata: WorkflowMetadata[];
  triggersMetadata: WorkflowMetadata[];
  onAddAction: () => void;
  onDeleteAction: (id: string) => void;
  onEditAction: (id: string) => void;
}

export function WorkflowCanvas({ 
  workflow, 
  actionsMetadata, 
  triggersMetadata,
  onAddAction,
  onDeleteAction,
  onEditAction
}: WorkflowCanvasProps) {
  
  const triggerInfo = triggersMetadata.find((t: any) => t.value === workflow.triggerType);

  return (
    <div className="relative w-full min-h-[600px] bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 p-8 overflow-hidden animate-in zoom-in-95 duration-500">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      <div className="relative z-10 flex flex-col items-center space-y-8">
        
        {/* TRIGGER NODE */}
        <div className="group relative">
          <Card className="w-64 border-2 border-primary shadow-lg bg-white rounded-2xl overflow-hidden hover:scale-105 transition-transform duration-300">
            <div className="bg-primary p-2 flex items-center justify-center gap-2">
              <Zap size={14} className="text-white fill-white" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Déclencheur</span>
            </div>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                {triggerInfo?.icon ? React.createElement(triggerInfo.icon, { size: 24 }) : <Zap size={24} />}
              </div>
              <div>
                <h4 className="font-bold text-sm">{triggerInfo?.label || "Événement"}</h4>
                <p className="text-[10px] text-muted-foreground">Démarrage du flux</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Connector to first action */}
          {workflow.actions.length > 0 && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-0.5 h-8 bg-primary/30"></div>
              <ArrowDown size={16} className="text-primary/40 -mt-1" />
            </div>
          )}
        </div>

        {/* ACTION NODES */}
        <div className="flex flex-col items-center space-y-12 w-full max-w-2xl">
          {workflow.actions.map((action, index) => {
            const meta = actionsMetadata.find(a => a.value === action.type);
            const isLast = index === workflow.actions.length - 1;

            return (
              <div key={action.id} className="group relative w-full flex flex-col items-center">
                <Card className="w-80 border-none shadow-xl bg-white rounded-2xl overflow-hidden hover:ring-2 ring-primary/20 hover:shadow-2xl transition-all duration-300">
                  <div className={`h-1.5 w-full ${action.type.startsWith('ai_') ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                        <GripVertical size={18} />
                      </div>
                      <div className={`p-3 rounded-xl ${action.type.startsWith('ai_') ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        {meta?.icon ? React.createElement(meta.icon, { size: 20 }) : <LayoutGrid size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{meta?.label || action.type}</h4>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 uppercase">
                          {action.type.startsWith('ai_') ? 'IA' : 'CRM'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onEditAction(action.id)}>
                        <Settings2 size={14} className="text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-50" onClick={() => onDeleteAction(action.id)}>
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Connector to next action or Add button */}
                {!isLast ? (
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-0.5 h-12 bg-slate-200"></div>
                    <ArrowDown size={16} className="text-slate-300 -mt-1" />
                  </div>
                ) : (
                  <div className="pt-8 flex flex-col items-center">
                    <div className="w-0.5 h-8 bg-slate-200 border-dashed border-l"></div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-full border-dashed border-2 gap-2 text-muted-foreground hover:text-primary hover:border-primary transition-all"
                      onClick={onAddAction}
                    >
                      <Plus size={14} /> Ajouter une étape
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {workflow.actions.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Plus size={32} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">Aucune action définie</p>
              <Button variant="link" className="text-primary mt-2" onClick={onAddAction}>
                Commencer à construire le flux
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
