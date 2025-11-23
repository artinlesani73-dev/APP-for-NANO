import React from 'react';
import { Sliders, HelpCircle } from 'lucide-react';
import { GenerationConfig } from '../types';

interface ParametersPanelProps {
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({ config, setConfig }) => {
  
  const handleChange = (key: keyof GenerationConfig, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-6">
      <div className="flex items-center gap-2 text-zinc-300 font-medium pb-2 border-b border-zinc-800">
        <Sliders size={16} />
        <span>Parameters</span>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
            <label className="text-xs font-medium text-zinc-400">Model</label>
        </div>
        <select 
            value={config.model}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
        >
            <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Free Tier / Fast)</option>
            <option value="gemini-3-pro-image-preview">Gemini 3.0 Pro Image (Paid Project / High Quality)</option>
        </select>
      </div>

      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
            Temperature
            <div title="Controls randomness. Lower = more predictable." className="cursor-help opacity-50"><HelpCircle size={10} /></div>
          </label>
          <span className="text-xs text-zinc-500 font-mono">{config.temperature.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.temperature}
          onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Top P */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-zinc-400">Top P</label>
          <span className="text-xs text-zinc-500 font-mono">{config.top_p.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.top_p}
          onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-zinc-400">Aspect Ratio</label>
        <div className="grid grid-cols-3 gap-2">
          {['1:1', '16:9', '9:16', '3:4', '4:3'].map((ratio) => (
            <