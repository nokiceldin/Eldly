import { useState, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Task } from "../engine";
import { useReducedMotion } from "../useReducedMotion";
const dragId=(date:string,id:string)=>JSON.stringify([date,id]);
export function TaskDragArea({children,onMove,onActive}:{children:ReactNode;onMove:(task:Task,day:string,index:number)=>void;onActive:(active:boolean)=>void}) {
  const [active,setActive]=useState<Task|null>(null);
  const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{delay:220,tolerance:6}}),useSensor(TouchSensor,{activationConstraint:{delay:300,tolerance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  const finish=(event:DragEndEvent)=>{
    setActive(null);onActive(false);
    const source=event.active.data.current,target=event.over?.data.current;
    if(!source?.task||!target?.day||event.active.id===event.over?.id)return;
    const ids: string[]=target.ids||[];
    const without=ids.filter(id=>id!==source.task.id);
    const overIndex=target.task?without.indexOf(target.task.id):without.length;
    const translated=event.active.rect.current.translated;
    const after=!!(target.task&&translated&&event.over&&translated.top+translated.height/2>event.over.rect.top+event.over.rect.height/2);
    onMove(source.task,target.day,Math.max(0,overIndex)+(after?1:0));
  };
  return <DndContext sensors={sensors} collisionDetection={args=>{
    const hits=pointerWithin(args);if(!hits.length)return closestCenter(args);
    const rows=hits.filter(hit=>args.droppableContainers.find(c=>c.id===hit.id)?.data.current?.task);
    return rows.length?rows:hits;
  }} onDragStart={event=>{setActive(event.active.data.current?.task||null);onActive(true);}} onDragCancel={()=>{setActive(null);onActive(false);}} onDragEnd={finish} accessibility={{screenReaderInstructions:{draggable:"Hold to move a task. With a keyboard, press Space, use the arrow keys, and press Space to drop or Escape to cancel."}}}>
    {children}<DragOverlay dropAnimation={null}>{active&&<div className="task-drag-overlay">{active.title}</div>}</DragOverlay>
  </DndContext>;
}
export function TaskDropDay({day,tasks,children}:{day:string;tasks:Task[];children:ReactNode}) {
  const {setNodeRef,isOver}=useDroppable({id:`day:${day}`,data:{day,ids:tasks.map(t=>t.id)}});
  return <div ref={setNodeRef} className={`task-drop-day ${isOver?'task-drop-hover':''}`}><SortableContext items={tasks.map(t=>dragId(day,t.id))} strategy={verticalListSortingStrategy}>{children}</SortableContext></div>;
}
export function DraggableTask({task,day,tasks,children}:{task:Task;day:string;tasks:Task[];children:ReactNode}) {
  const {setNodeRef,attributes,listeners,transform,transition,isDragging}=useSortable({id:dragId(day,task.id),data:{task,day,ids:tasks.map(t=>t.id)}});
  const reduce=useReducedMotion();
  return <div ref={setNodeRef} {...attributes} {...listeners} className={`task-draggable ${isDragging?'task-is-dragging':''}`} style={{transform:CSS.Transform.toString(transform),transition:reduce?undefined:transition,opacity:isDragging?.25:1}} aria-label={`Move ${task.title}`} onContextMenu={e=>e.preventDefault()}>{children}</div>;
}
