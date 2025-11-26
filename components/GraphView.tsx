import React, { useState, useRef, useEffect } from 'react';
import { Session, SessionGeneration, GenerationConfig, GraphNode, GraphEdge } from '../types';
import { FileText, Settings, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { StorageService } from '../services/newStorageService';

interface GraphViewProps {
  sessions: Session[];
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
  onGenerateFromNode?: (prompt: string, config: GenerationConfig, controlImages?: string[], referenceImages?: string[]) => Promise<void>;
}

type Node = GraphNode;
type Edge = GraphEdge;

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

const NODE_WIDTH = 230;
const NODE_HEIGHT = 150;
const IMAGE_NODE_HEIGHT = 320;
const OUTPUT_IMAGE_HEIGHT = 420;
const WORKFLOW_NODE_HEIGHT = 240;
const WORKFLOW_NODE_WIDTH = 300;
const OUTPUT_IMAGE_WIDTH = 260;
const BASE_X = 100;
const BASE_Y = 160;
const COLUMN_SPACING = 360;
const GENERATION_SPACING = 460;

const themeTokens = {
  dark: {
    background: '#0d0b14',
    card: '#161021',
    cardMuted: '#120d1b',
    stroke: '#2c243c',
    border: 'border-white/5',
    textPrimary: 'text-zinc-100',
    textMuted: 'text-zinc-400',
    panel: 'bg-[#161021]/85 border border-white/5 backdrop-blur-lg',
  },
  light: {
    background: '#f5f7fd',
    card: '#ffffff',
    cardMuted: '#f1f3fb',
    stroke: '#e5e7eb',
    border: 'border-zinc-200',
    textPrimary: 'text-zinc-900',
    textMuted: 'text-zinc-500',
    panel: 'bg-white/90 border border-zinc-200 backdrop-blur-xl',
  }
};

const GraphView: React.FC<GraphViewProps> = ({ sessions, theme, loadImage, onGenerateFromNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const palette = themeTokens[theme];
  const nodeAccents: Record<Node['type'], { solid: string; soft: string; text: string }> = {
    'prompt': { solid: '#a855f7', soft: 'rgba(168,85,247,0.12)', text: '#f5ecff' },
    'workflow': { solid: '#6366f1', soft: 'rgba(99,102,241,0.12)', text: '#eef1ff' },
    'control-image': { solid: '#10b981', soft: 'rgba(16,185,129,0.1)', text: '#e6fff4' },
    'reference-image': { solid: '#3b82f6', soft: 'rgba(59,130,246,0.12)', text: '#e8f1ff' },
    'output-image': { solid: '#f59e0b', soft: 'rgba(245,158,11,0.14)', text: '#fff8e6' },
    'output-text': { solid: '#f59e0b', soft: 'rgba(245,158,11,0.14)', text: '#fff8e6' }
  } as const;
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.7);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle?: string } | null>(null);
  const [connectionPreview, setConnectionPreview] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [graphLoaded, setGraphLoaded] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | 'all'>('all');

  const lastSessionsLength = useRef<number>(0);

  useEffect(() => {
    // Regenerate graph when sessions change
    const totalGenerations = sessions.reduce((sum, s) => sum + s.generations.length, 0);
    if (totalGenerations !== lastSessionsLength.current) {
      lastSessionsLength.current = totalGenerations;
      setGraphLoaded(false);
      generateGraphLayout();
    }
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    if (editingNode && nodes.length > 0) {
      setEditingNode(null);
    }
  }, [nodes.length]);

  // Handle wheel events with non-passive listener
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      setZoom(prevZoom => Math.min(Math.max(0.2, prevZoom + delta), 2));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  // Helper function to create a unique key for workflow grouping
  const getWorkflowGroupKey = (
    promptText: string,
    params: GenerationConfig,
    userName: string,
    controlImageIds: string[],
    referenceImageIds: string[]
  ) => {
    return JSON.stringify({
      prompt: promptText,
      params,
      user: userName,
      control: controlImageIds.sort(),
      reference: referenceImageIds.sort()
    });
  };

  // Helper function to get image key for deduplication
  const getImageKey = (role: 'control' | 'reference' | 'output', id: string, filename: string) => {
    return `${role}-${id}-${filename}`;
  };

  const generateGraphLayout = () => {
    // Filter sessions based on selection
    const filteredSessions = selectedSessionId === 'all'
      ? sessions
      : sessions.filter(s => s.session_id === selectedSessionId);

    if (filteredSessions.length === 0) {
      setNodes([]);
      setEdges([]);
      setGraphLoaded(true);
      return;
    }

    // Collect all generations
    const allGenerations: Array<{ session: Session; generation: SessionGeneration }> = [];
    filteredSessions.forEach(session => {
      session.generations.forEach(generation => {
        allGenerations.push({ session, generation });
      });
    });

    if (allGenerations.length === 0) {
      setNodes([]);
      setEdges([]);
      setGraphLoaded(true);
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Maps for grouping
    const promptGroups = new Map<string, string>(); // prompt text -> node id
    const workflowGroups = new Map<string, string>(); // workflow key -> node id
    const imageGroups = new Map<string, string>(); // image key -> node id

    let yOffset = BASE_Y;

    allGenerations.forEach(({ session, generation }, genIndex) => {
      const userName = 'User'; // We'll use a default user name for now

      // 1. Handle Prompt Node (group by exact text)
      const promptText = generation.prompt || 'Empty prompt';
      let promptNodeId = promptGroups.get(promptText);

      if (!promptNodeId) {
        promptNodeId = `prompt-${promptText.substring(0, 20).replace(/\s+/g, '-')}-${genIndex}`;
        promptGroups.set(promptText, promptNodeId);

        newNodes.push({
          id: promptNodeId,
          type: 'prompt',
          label: 'Prompt',
          x: BASE_X,
          y: yOffset,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: { text: promptText, status: generation.status }
        });
      }

      // 2. Handle Control Images (deduplicate)
      const controlImageIds: string[] = [];
      (generation.control_images || []).forEach((img, idx) => {
        const imageKey = getImageKey('control', img.id, img.filename);
        let imageNodeId = imageGroups.get(imageKey);

        if (!imageNodeId) {
          imageNodeId = `control-${img.id}`;
          imageGroups.set(imageKey, imageNodeId);
          const imageData = loadImage('control', img.id, img.filename);

          newNodes.push({
            id: imageNodeId,
            type: 'control-image',
            label: `Control`,
            x: BASE_X + COLUMN_SPACING,
            y: yOffset + idx * (IMAGE_NODE_HEIGHT + 30),
            width: NODE_WIDTH,
            height: IMAGE_NODE_HEIGHT,
            data: { image: img, imageData }
          });
        }

        controlImageIds.push(imageNodeId);
      });

      // 3. Handle Reference Images (deduplicate)
      const referenceImageIds: string[] = [];
      (generation.reference_images || []).forEach((img, idx) => {
        const imageKey = getImageKey('reference', img.id, img.filename);
        let imageNodeId = imageGroups.get(imageKey);

        if (!imageNodeId) {
          imageNodeId = `reference-${img.id}`;
          imageGroups.set(imageKey, imageNodeId);
          const imageData = loadImage('reference', img.id, img.filename);

          newNodes.push({
            id: imageNodeId,
            type: 'reference-image',
            label: `Reference`,
            x: BASE_X + COLUMN_SPACING,
            y: yOffset + (controlImageIds.length + idx) * (IMAGE_NODE_HEIGHT + 30),
            width: NODE_WIDTH,
            height: IMAGE_NODE_HEIGHT,
            data: { image: img, imageData }
          });
        }

        referenceImageIds.push(imageNodeId);
      });

      // 4. Handle Workflow Node (group by exact match of all inputs)
      const workflowGroupKey = getWorkflowGroupKey(
        promptText,
        generation.parameters,
        userName,
        controlImageIds,
        referenceImageIds
      );
      let workflowNodeId = workflowGroups.get(workflowGroupKey);

      if (!workflowNodeId) {
        workflowNodeId = `workflow-${genIndex}`;
        workflowGroups.set(workflowGroupKey, workflowNodeId);

        newNodes.push({
          id: workflowNodeId,
          type: 'workflow',
          label: 'Workflow',
          x: BASE_X + COLUMN_SPACING * 2,
          y: yOffset,
          width: WORKFLOW_NODE_WIDTH,
          height: WORKFLOW_NODE_HEIGHT,
          data: { parameters: generation.parameters, userName }
        });
      }

      // 5. Create edges from prompt to workflow
      const promptEdge = {
        from: promptNodeId,
        to: workflowNodeId,
        toHandle: 'prompt' as const,
        color: '#8b5cf6'
      };
      if (!newEdges.some(e => e.from === promptEdge.from && e.to === promptEdge.to && e.toHandle === promptEdge.toHandle)) {
        newEdges.push(promptEdge);
      }

      // 6. Create edges from control images to workflow
      controlImageIds.forEach(imageId => {
        const edge = {
          from: imageId,
          to: workflowNodeId,
          toHandle: 'control' as const,
          color: '#10b981'
        };
        if (!newEdges.some(e => e.from === edge.from && e.to === edge.to && e.toHandle === edge.toHandle)) {
          newEdges.push(edge);
        }
      });

      // 7. Create edges from reference images to workflow
      referenceImageIds.forEach(imageId => {
        const edge = {
          from: imageId,
          to: workflowNodeId,
          toHandle: 'reference' as const,
          color: '#3b82f6'
        };
        if (!newEdges.some(e => e.from === edge.from && e.to === edge.to && e.toHandle === edge.toHandle)) {
          newEdges.push(edge);
        }
      });

      // 8. Handle Output Images (deduplicate)
      const outputImages = generation.output_images || (generation.output_image ? [generation.output_image] : []);
      outputImages.forEach((img, idx) => {
        const imageKey = getImageKey('output', img.id, img.filename);
        let imageNodeId = imageGroups.get(imageKey);

        if (!imageNodeId) {
          imageNodeId = `output-${img.id}`;
          imageGroups.set(imageKey, imageNodeId);
          const imageData = loadImage('output', img.id, img.filename);

          newNodes.push({
            id: imageNodeId,
            type: 'output-image',
            label: `Output`,
            x: BASE_X + COLUMN_SPACING * 3,
            y: yOffset + idx * (OUTPUT_IMAGE_HEIGHT + 40),
            width: OUTPUT_IMAGE_WIDTH,
            height: OUTPUT_IMAGE_HEIGHT,
            data: { image: img, imageData, text: generation.output_texts?.[idx] }
          });
        }

        // Create edge from workflow to output
        const edge = {
          from: workflowNodeId,
          to: imageNodeId,
          color: '#f59e0b'
        };
        if (!newEdges.some(e => e.from === edge.from && e.to === edge.to)) {
          newEdges.push(edge);
        }
      });

      yOffset += GENERATION_SPACING;
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setGraphLoaded(true);
  };

  const getInputHandlePosition = (node: Node, handle?: 'prompt' | 'control' | 'reference') => {
    if (node.type === 'workflow' && handle) {
      const handleSpacing = node.height / 4;
      const handleYOffsets = {
        prompt: handleSpacing,
        control: handleSpacing * 2,
        reference: handleSpacing * 3
      };
      return {
        x: node.x,
        y: node.y + handleYOffsets[handle]
      };
    }
    // For all other nodes, input handle is on the left center
    return {
      x: node.x,
      y: node.y + node.height / 2
    };
  };

  const getOutputHandlePosition = (node: Node) => {
    // All nodes have output handle on the right center
    return {
      x: node.x + node.width,
      y: node.y + node.height / 2
    };
  };

  const generateCurvePath = (from: Node, to: Node, toHandle?: 'prompt' | 'control' | 'reference') => {
    const fromPos = getOutputHandlePosition(from);
    const fromX = fromPos.x;
    const fromY = fromPos.y;

    const toPos = getInputHandlePosition(to, toHandle);
    const toX = toPos.x;
    const toY = toPos.y;

    const midX = (fromX + toX) / 2;

    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId?: string) => {
    if (nodeId) {
      // Start dragging a node
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDraggingNode(nodeId);
        setIsDraggingNode(true);
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const svgX = (e.clientX - rect.left - pan.x) / zoom;
          const svgY = (e.clientY - rect.top - pan.y) / zoom;
          setDragOffset({
            x: svgX - node.x,
            y: svgY - node.y
          });
        }
      }
    } else if (e.button === 0) {
      // Start panning the canvas
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      // Drag the node
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;

        setNodes(prevNodes =>
          prevNodes.map(n =>
            n.id === draggingNode
              ? { ...n, x: svgX - dragOffset.x, y: svgY - dragOffset.y }
              : n
          )
        );
      }
    } else if (connectingFrom) {
      // Update connection preview
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;
        setConnectionPreview({ x: svgX, y: svgY });
      }
    } else if (isPanning) {
      // Pan the canvas
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
    setIsDraggingNode(false);
    setConnectingFrom(null);
    setConnectionPreview(null);
  };

  // Drag and drop handlers for external images
  const handleDragOver = (e: React.DragEvent) => {
    // Only handle external file drags, not internal node drags
    if (!isDraggingNode && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDraggingNode && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    // Only handle external file drops, not node drags
    if (isDraggingNode || !e.dataTransfer.types.includes('Files')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const svgX = (e.clientX - rect.left - pan.x) / zoom;
    const svgY = (e.clientY - rect.top - pan.y) / zoom;

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const reader = new FileReader();

      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newNode: Node = {
          id: `standalone-control-${Date.now()}-${i}`,
          type: 'control-image',
          label: file.name,
          x: svgX + (i * 250),
          y: svgY,
          width: NODE_WIDTH,
          height: IMAGE_NODE_HEIGHT,
          isStandalone: true,
          data: { image: { filename: file.name }, imageData: base64 }
        };
        setNodes(prev => [...prev, newNode]);
      };

      reader.readAsDataURL(file);
    }
  };

  // Generate from workflow node
  const handleGenerateFromWorkflow = async (workflowNodeId: string) => {
    if (!onGenerateFromNode) return;

    const workflowNode = nodes.find(n => n.id === workflowNodeId);
    if (!workflowNode || workflowNode.type !== 'workflow') return;

    // Find connected nodes
    const connectedEdges = edges.filter(e => e.to === workflowNodeId);
    const promptEdge = connectedEdges.find(e => e.toHandle === 'prompt');
    const controlEdges = connectedEdges.filter(e => e.toHandle === 'control');
    const referenceEdges = connectedEdges.filter(e => e.toHandle === 'reference');

    // Get prompt
    const promptNode = promptEdge ? nodes.find(n => n.id === promptEdge.from) : null;
    const prompt = promptNode?.data?.text || 'Default prompt';

    // Get control images
    const controlImages: string[] = [];
    for (const edge of controlEdges) {
      const node = nodes.find(n => n.id === edge.from);
      if (node?.data?.imageData) {
        controlImages.push(node.data.imageData);
      }
    }

    // Get reference images
    const referenceImages: string[] = [];
    for (const edge of referenceEdges) {
      const node = nodes.find(n => n.id === edge.from);
      if (node?.data?.imageData) {
        referenceImages.push(node.data.imageData);
      }
    }

    // Call the generation function
    await onGenerateFromNode(
      prompt,
      workflowNode.data.parameters,
      controlImages.length > 0 ? controlImages : undefined,
      referenceImages.length > 0 ? referenceImages : undefined
    );
  };

  // Update node data (for editing)
  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  // Handle connection start from a handle
  const handleConnectionStart = (e: React.MouseEvent, nodeId: string, handle?: string) => {
    e.stopPropagation();
    setConnectingFrom({ nodeId, handle });
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const svgX = (e.clientX - rect.left - pan.x) / zoom;
      const svgY = (e.clientY - rect.top - pan.y) / zoom;
      setConnectionPreview({ x: svgX, y: svgY });
    }
  };

  // Handle connection end on a handle
  const handleConnectionEnd = (e: React.MouseEvent, toNodeId: string, toHandle?: string) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.nodeId !== toNodeId) {
      const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
      const toNode = nodes.find(n => n.id === toNodeId);

      if (!fromNode || !toNode) {
        setConnectingFrom(null);
        setConnectionPreview(null);
        return;
      }

      // Validation rules
      let isValid = true;
      let errorMessage = '';

      // Rule 1: Workflow prompt handle only accepts prompt nodes (not images)
      if (toNode.type === 'workflow' && toHandle === 'prompt') {
        if (fromNode.type !== 'prompt') {
          isValid = false;
          errorMessage = 'Prompt handle only accepts prompt nodes';
        }
        // Check if already has a prompt connection
        const existingPromptEdge = edges.find(
          e => e.to === toNodeId && e.toHandle === 'prompt'
        );
        if (existingPromptEdge) {
          isValid = false;
          errorMessage = 'Workflow already has a prompt connected';
        }
      }

      // Rule 2: Workflow control handle only accepts image nodes
      if (toNode.type === 'workflow' && toHandle === 'control') {
        if (!fromNode.type.includes('image')) {
          isValid = false;
          errorMessage = 'Control handle only accepts image nodes';
        }
      }

      // Rule 3: Workflow reference handle only accepts image nodes
      if (toNode.type === 'workflow' && toHandle === 'reference') {
        if (!fromNode.type.includes('image')) {
          isValid = false;
          errorMessage = 'Reference handle only accepts image nodes';
        }
      }

      if (!isValid) {
        alert(errorMessage);
        setConnectingFrom(null);
        setConnectionPreview(null);
        return;
      }

      // Determine edge color based on handle type
      let color = '#8b5cf6'; // default purple
      if (toHandle === 'control') color = '#10b981'; // green
      else if (toHandle === 'reference') color = '#3b82f6'; // blue
      else if (!toHandle) color = '#f59e0b'; // amber for output

      const newEdge: Edge = {
        from: connectingFrom.nodeId,
        to: toNodeId,
        toHandle: toHandle as 'prompt' | 'control' | 'reference' | undefined,
        color
      };
      setEdges(prevEdges => {
        const duplicate = prevEdges.some(
          e => e.from === newEdge.from && e.to === newEdge.to && e.toHandle === newEdge.toHandle
        );
        if (duplicate) return prevEdges;
        return [...prevEdges, newEdge];
      });
    }
    setConnectingFrom(null);
    setConnectionPreview(null);
  };

  const renderNode = (node: Node) => {
    const isImage = node.type.includes('image');
    const isDark = theme === 'dark';
    const accent = nodeAccents[node.type];
    // Disable workflow editing in graph view since we're viewing across sessions
    const workflowEditingEnabled = false;
    const isWorkflowEditing = workflowEditingEnabled && editingNode === node.id;

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleMouseDown(e, node.id);
        }}
        style={{ cursor: 'move' }}
      >
        <rect
          width={node.width}
          height={node.height}
          rx={18}
          fill={palette.card}
          stroke={palette.stroke}
          strokeWidth={1.2}
        />

        {/* Node icon and title */}
        <g transform="translate(14, 12)">
          <foreignObject width={node.width - 28} height={20}>
            <div
              className="flex items-center gap-2 text-[12px]"
              style={{ color: isDark ? '#f7f7fb' : '#0f172a' }}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center">
                {node.type === 'prompt' && <FileText size={14} color={accent.solid} />}
                {node.type === 'workflow' && <Settings size={14} color={accent.solid} />}
                {node.type.includes('image') && <ImageIcon size={14} color={accent.solid} />}
              </span>
              <span className="text-sm font-semibold tracking-tight" style={{ color: isDark ? '#f3f1ff' : '#0f172a' }}>{node.label}</span>
            </div>
          </foreignObject>
        </g>

        {/* Node content */}
        <foreignObject x={14} y={52} width={node.width - 28} height={node.height - 64}>
          <div className={`flex flex-col h-full gap-3 text-[12px] leading-[18px] ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
            {node.type === 'prompt' && (
              node.isStandalone && editingNode === node.id ? (
                <textarea
                  className="w-full h-full bg-transparent text-[12px] leading-[18px] text-inherit resize-none outline-none"
                  value={node.data.text}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { text: e.target.value });
                  }}
                  onBlur={() => setEditingNode(null)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <p
                  className="text-[12px] leading-[18px] whitespace-pre-wrap break-words cursor-text select-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (node.isStandalone) setEditingNode(node.id);
                  }}
                >
                  {node.data.text}
                </p>
              )
            )}

            {node.type === 'workflow' && (
              <div className="flex flex-col gap-2 py-1">
                {node.data?.userName && (
                  <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    <span>User</span>
                    <span className={`${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>{node.data.userName}</span>
                  </div>
                )}
                <div className={`grid grid-cols-2 gap-y-1 text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <span>Model</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.model.includes('flash') ? 'Flash' : 'Pro'}
                  </span>
                  <span>Temperature</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.temperature}
                  </span>
                  <span>Top-p</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.top_p}
                  </span>
                  <span>Aspect</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.aspect_ratio}
                  </span>
                  <span>Size</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium`}>
                    {node.data.parameters.image_size}
                  </span>
                  <span>Safety</span>
                  <span className={`text-right ${isDark ? 'text-zinc-100' : 'text-zinc-800'} font-medium capitalize`}>
                    {node.data.parameters.safety_filter}
                  </span>
                </div>
              </div>
            )}

            {isImage && (
              <div className="h-full flex flex-col gap-2">
                <div className={`flex-1 rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-black/30' : 'border-zinc-200 bg-white'}`}>
                  {node.data.imageData ? (
                    <img
                      src={node.data.imageData}
                      alt={node.label}
                      className="w-full h-[280px] object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className={`w-full h-[280px] flex items-center justify-center ${isDark ? 'bg-black/20' : 'bg-zinc-50'}`}>
                      <ImageIcon className={isDark ? 'text-zinc-500' : 'text-zinc-400'} size={32} />
                    </div>
                  )}
                </div>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} truncate`}>
                  {node.data.image?.filename || 'No image'}
                </p>
                {node.type === 'output-image' && (
                  <p className={`text-[11px] leading-[18px] whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {node.data.text || 'Text output will appear here'}
                  </p>
                )}
              </div>
            )}

            {node.type === 'output-text' && (
              <div className="h-full flex flex-col">
                <p className={`w-full h-full text-[12px] leading-[18px] whitespace-pre-wrap break-words ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                  {node.data.text || 'Text output'}
                </p>
              </div>
            )}
          </div>
        </foreignObject>

        {/* Workflow node handles */}
        {node.type === 'workflow' && (
          <>
            {/* Prompt handle */}
            <circle
              cx={0}
              cy={node.height / 4}
              r={6}
              className="fill-[#b977ff] stroke-[#e6d8ff] cursor-pointer"
              strokeWidth={1.5}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id, 'prompt')}
              style={{ cursor: 'crosshair' }}
            />

            {/* Control handle */}
            <circle
              cx={0}
              cy={(node.height / 4) * 2}
              r={6}
              className="fill-[#4ad8a4] stroke-[#cff7e5] cursor-pointer"
              strokeWidth={1.5}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id, 'control')}
              style={{ cursor: 'crosshair' }}
            />

            {/* Reference handle */}
            <circle
              cx={0}
              cy={(node.height / 4) * 3}
              r={6}
              className="fill-[#6bb2ff] stroke-[#d6e8ff] cursor-pointer"
              strokeWidth={1.5}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id, 'reference')}
              style={{ cursor: 'crosshair' }}
            />

            {/* Output handle */}
            <circle
              cx={node.width}
              cy={node.height / 2}
              r={6}
              className="fill-[#f5b454] stroke-[#ffe6ba] cursor-pointer"
              strokeWidth={1.5}
              onMouseDown={(e) => handleConnectionStart(e, node.id)}
              style={{ cursor: 'crosshair' }}
            />
          </>
        )}

        {/* Standard connection points for other nodes */}
        {node.type !== 'workflow' && (
          <>
            {/* Output handle (right side) */}
            <circle
              cx={node.width}
              cy={node.height / 2}
              r={4}
              className={`${isDark ? 'fill-[#9f8ac7]' : 'fill-zinc-500'} cursor-pointer`}
              onMouseDown={(e) => handleConnectionStart(e, node.id)}
              style={{ cursor: 'crosshair' }}
            />
            {/* Input handle (left side) */}
            <circle
              cx={0}
              cy={node.height / 2}
              r={4}
              className={`${isDark ? 'fill-[#9f8ac7]' : 'fill-zinc-500'} cursor-pointer`}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id)}
              style={{ cursor: 'crosshair' }}
            />
          </>
        )}
      </g>
    );
  };

  const renderEdge = (edge: Edge, index: number) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return null;

    const path = generateCurvePath(fromNode, toNode, edge.toHandle);

    // Generate unique key using index to avoid duplicates
    const key = `edge-${index}-${edge.from}-${edge.to}-${edge.toHandle || 'none'}`;

    return (
      <path
        key={key}
        d={path}
        stroke={edge.color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        opacity={0.9}
      />
    );
  };

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden select-none ${isDark ? 'text-white' : 'text-zinc-900'}`}
      style={{
        backgroundColor: palette.background,
        backgroundImage: `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }}
    >
      {/* Controls */}
      <div className={`absolute top-4 right-4 z-10 flex flex-col gap-3 p-3 rounded-2xl backdrop-blur-xl ${palette.panel}`}>
        {[{
          icon: <ZoomIn size={16} />, label: 'Zoom In', action: () => setZoom(Math.min(zoom + 0.1, 2))
        }, {
          icon: <ZoomOut size={16} />, label: 'Zoom Out', action: () => setZoom(Math.max(zoom - 0.1, 0.2))
        }, {
          icon: <Maximize2 size={16} />, label: 'Reset View', action: () => { setZoom(0.7); setPan({ x: 50, y: 50 }); }
        }].map((item, idx) => (
          <button
            key={idx}
            onClick={item.action}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition-all border ${isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-900'}`}
          >
            <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${isDark ? 'bg-white/5' : 'bg-zinc-100'} border border-white/10`}>
              {item.icon}
            </span>
            <span className="flex-1 text-left font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Graph canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${isDraggingOver ? 'ring-4 ring-blue-500' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render edges first (behind nodes) */}
          {edges.map((edge, index) => renderEdge(edge, index))}

          {/* Render connection preview */}
          {connectingFrom && connectionPreview && (() => {
            const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
            if (!fromNode) return null;

            const fromX = fromNode.x + fromNode.width;
            const fromY = fromNode.y + fromNode.height / 2;
            const toX = connectionPreview.x;
            const toY = connectionPreview.y;
            const midX = (fromX + toX) / 2;

            const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

            return (
              <path
                d={path}
                stroke="#a855f7"
                strokeWidth={2.5}
                fill="none"
                opacity={0.8}
                strokeDasharray="8,4"
                strokeLinecap="round"
              />
            );
          })()}

          {/* Render nodes */}
          {nodes.map(renderNode)}
        </g>
      </svg>

      {/* Session Filter */}
      <div className={`absolute top-4 left-4 rounded-2xl p-4 space-y-3 w-72 backdrop-blur-xl ${palette.panel}`}>
        <div className="flex items-center justify-between">
          <div className={`font-semibold text-sm ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Graph Overview</div>
          <span className={`text-[11px] px-2 py-1 rounded-full ${isDark ? 'bg-white/5 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
            {nodes.length} nodes
          </span>
        </div>
        <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Choose which session to visualize</div>
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value as string)}
          className={`w-full px-3 py-2 text-sm rounded-xl border transition-all ${
            isDark
              ? 'bg-black/30 border-white/10 text-zinc-100 hover:bg-white/5'
              : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <option value="all">All Sessions ({sessions.length})</option>
          {sessions.map(session => (
            <option key={session.session_id} value={session.session_id}>
              {session.title} ({session.generations.length})
            </option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className={`absolute bottom-4 left-4 rounded-2xl p-4 space-y-3 text-xs w-72 backdrop-blur-xl ${palette.panel}`}>
        <div className={`font-semibold text-sm ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
          {selectedSessionId === 'all'
            ? `All Sessions (${sessions.length})`
            : sessions.find(s => s.session_id === selectedSessionId)?.title || 'Session'}
        </div>
        <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {nodes.length} nodes · {edges.length} edges
        </div>
        <div className="space-y-2">
          {[{ label: 'Prompt Flow', color: 'from-purple-500 to-purple-400' }, { label: 'Control Images', color: 'from-emerald-500 to-emerald-400' }, { label: 'Reference Images', color: 'from-sky-500 to-sky-400' }, { label: 'Output', color: 'from-amber-500 to-amber-400' }].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-6 h-1 bg-gradient-to-r ${item.color} rounded-full`} />
              <span className={isDark ? 'text-zinc-200' : 'text-zinc-700'}>{item.label}</span>
            </div>
          ))}
        </div>
        <div className={`mt-2 pt-3 border-t space-y-1.5 ${isDark ? 'border-white/5 text-zinc-500' : 'border-zinc-200 text-zinc-600'}`}>
          <div>💡 Drag nodes to reposition</div>
          <div>🔗 Connect handles to link steps</div>
          <div>🖱️ Pan the canvas with drag</div>
          <div>🔍 Scroll to zoom</div>
          <div>📁 Drop images onto canvas</div>
        </div>
      </div>

      {/* Drag overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm">
          <div className={`text-2xl font-bold px-6 py-4 rounded-2xl ${isDark ? 'text-blue-400 bg-zinc-900/50' : 'text-blue-600 bg-white/50'}`}>
            Drop images here to add to canvas
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphView;
