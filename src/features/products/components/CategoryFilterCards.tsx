'use client';

import React from 'react';
import { ScrollMenu, VisibilityContext } from 'react-horizontal-scrolling-menu';
import { FiChevronLeft, FiChevronRight, FiPackage } from 'react-icons/fi';
import { Check } from 'lucide-react';
import { Category } from '@odin6/types';
import { Product } from '@odin6/types';
import 'react-horizontal-scrolling-menu/dist/styles.css';

// CSS para ocultar la barra de scroll
const scrollbarHideStyles = `
  .scrollbar-hide {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .react-horizontal-scrolling-menu--wrapper {
    overflow: hidden !important;
  }
  .react-horizontal-scrolling-menu--scroll-container {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .react-horizontal-scrolling-menu--scroll-container::-webkit-scrollbar {
    display: none;
  }
`;

interface CategoryFilterCardsProps {
  categories: Category[];
  products: Product[];
  selectedCategory: string | null;
  onCategorySelectAction: (categoryId: string | null) => void;
}

export const CategoryFilterCards = ({
  categories,
  products,
  selectedCategory,
  onCategorySelectAction,
}: CategoryFilterCardsProps) => {
  // Inyectar estilos CSS personalizados
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = scrollbarHideStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const allItems = [
    {
      id: 'all',
      name: 'Todas',
      count: products.length,
      description: 'Ver todos',
      imageUrl: null,
    },
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: products.filter((p) => p.categoryId === category.id).length,
      description: `${products.filter((p) => p.categoryId === category.id).length} ${products.filter((p) => p.categoryId === category.id).length === 1 ? 'producto' : 'productos'}`,
      imageUrl: category.imageUrl,
    })),
  ];

  return (
    <div className="py-3 px-2 mb-3">
      {/* Scroll Container */}
      <div className="category-scroll-menu overflow-hidden px-1">
        <ScrollMenu
          LeftArrow={LeftArrow}
          RightArrow={RightArrow}
          itemClassName="p-2"
          wrapperClassName="scrollbar-hide "
        >
          {allItems.map((item) => (
            <CategoryCard
              key={item.id}
              itemId={item.id}
              isSelected={
                selectedCategory === (item.id === 'all' ? null : item.id)
              }
              onClick={() =>
                onCategorySelectAction(item.id === 'all' ? null : item.id)
              }
              imageUrl={item.imageUrl}
              name={item.name}
              count={item.count}
              description={item.description}
            />
          ))}
        </ScrollMenu>
      </div>
    </div>
  );
};

interface CategoryCardProps {
  itemId: string;
  isSelected: boolean;
  onClick: () => void;
  imageUrl?: string | null;
  name: string;
  count: number;
  description?: string;
}

const CategoryCard = ({
  isSelected,
  onClick,
  imageUrl,
  name,
  count,
}: CategoryCardProps) => {
  // Base classes for the card container
  const cardClasses = [
    'group relative flex-shrink-0 w-32 h-36 p-4 rounded-xl',
    'flex flex-col items-center justify-center transition-all duration-200 ',
    'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand/20',
  ].join(' ');

  // Dynamic classes based on selection state
  const dynamicClasses = isSelected
    ? 'bg-gradient-to-br from-page to-elevated shadow-md ring-2 ring-brand/30 border border-line'
    : 'bg-elevated hover:bg-surface border border-line hover:border-line shadow-sm';

  // Icon container classes
  const iconContainerClasses = [
    'mb-3 p-2.5 rounded-lg transition-all duration-200',
    isSelected ? 'bg-surface shadow-sm' : 'bg-surface group-hover:shadow-sm',
  ].join(' ');

  // Title classes
  const titleClasses = [
    'font-semibold text-xs leading-tight transition-colors duration-200 line-clamp-1',
    isSelected ? 'text-content' : 'text-dim',
  ].join(' ');

  // Count badge classes
  const countBadgeClasses = [
    'inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium',
    'transition-all duration-200',
    isSelected
      ? 'bg-brand text-on-brand'
      : 'bg-elevated text-dim group-hover:bg-dim/30',
  ].join(' ');

  // Icon classes
  const iconClasses = `w-6 h-6 ${isSelected ? 'text-brand' : 'text-dim'}`;

  return (
    <button onClick={onClick} className={`${cardClasses} ${dynamicClasses}`}>
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 bg-brand text-on-brand p-1 rounded-lg shadow-sm">
          <Check className="w-3 h-3" />
        </div>
      )}

      {/* Image/Icon container */}
      <div className={iconContainerClasses}>
        {imageUrl ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={imageUrl}
              alt={name}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center">
            <FiPackage className={iconClasses} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="text-center space-y-1">
        <h3 className={titleClasses}>{name}</h3>
        <div className={countBadgeClasses}>{count}</div>
      </div>
    </button>
  );
};

// Arrow components
function LeftArrow() {
  const { isFirstItemVisible, scrollPrev } =
    React.useContext(VisibilityContext);

  return (
    <button
      disabled={isFirstItemVisible}
      onClick={() => scrollPrev()}
      className="flex items-center justify-center w-8 h-8 rounded-full bg-surface shadow-md border border-line disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow mr-2"
    >
      <FiChevronLeft className="w-4 h-4 text-dim" />
    </button>
  );
}

function RightArrow() {
  const { isLastItemVisible, scrollNext } = React.useContext(VisibilityContext);

  return (
    <button
      disabled={isLastItemVisible}
      onClick={() => scrollNext()}
      className="flex items-center justify-center w-8 h-8 rounded-full bg-surface shadow-md border border-line disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow ml-2"
    >
      <FiChevronRight className="w-4 h-4 text-dim" />
    </button>
  );
}
