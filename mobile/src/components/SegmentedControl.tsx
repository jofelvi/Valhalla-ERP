import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';

interface Segment {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface SegmentedControlProps {
  segments: Segment[];
  selectedId: string;
  onChange: (id: string) => void;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  selectedId,
  onChange,
}) => {
  return (
    <View style={styles.container}>
      {segments.map((segment) => {
        const isSelected = segment.id === selectedId;
        return (
          <Pressable
            key={segment.id}
            style={[
              styles.segment,
              isSelected ? styles.segmentActive : styles.segmentInactive,
            ]}
            onPress={() => onChange(segment.id)}
            android_ripple={{ color: `${COLORS.primary}20` }}
          >
            {segment.icon && (
              <Ionicons
                name={segment.icon}
                size={18}
                color={isSelected ? COLORS.primary : COLORS.textSecondary}
                style={styles.icon}
              />
            )}
            <Text
              style={[
                styles.label,
                isSelected ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  segmentActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
  segmentInactive: {
    backgroundColor: 'transparent',
  },
  icon: {
    marginRight: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  labelActive: {
    color: COLORS.primary,
  },
  labelInactive: {
    color: COLORS.textSecondary,
  },
});
