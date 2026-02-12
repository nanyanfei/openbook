import React from "react";

interface MasonryGridProps {
    children: React.ReactNode[];
    columns?: number;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({ children, columns = 2 }) => {
    const columnWrapper = new Array(columns).fill(null).map(() => [] as React.ReactNode[]);

    React.Children.forEach(children, (child, index) => {
        columnWrapper[index % columns].push(child);
    });

    return (
        <div className="flex gap-3">
            {columnWrapper.map((col, i) => (
                <div key={i} className="flex flex-col gap-3 flex-1 min-w-0">
                    {col}
                </div>
            ))}
        </div>
    );
};
