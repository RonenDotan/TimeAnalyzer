import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ColorPalette, useTheme } from '../contexts/ThemeContext';
import { Goal, isGoalOverdue } from '../types/Goal';

const GOAL_COLOR = '#F97316';
const OVERDUE_COLOR = '#DC2626';

interface Props {
  goal: Goal;
  onPress?: () => void;
  asOf?: number;
}

function formatDeadline(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GoalCard({ goal, onPress, asOf }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const overdue = isGoalOverdue(goal, asOf);
  const goalColor = overdue ? OVERDUE_COLOR : GOAL_COLOR;
  const Body = (
    <>
      <View style={styles.topRow}>
        <Text style={styles.goalText} numberOfLines={1}>{goal.text}</Text>
        <Text style={[styles.goalPct, { color: goalColor }]}>{goal.progress}%</Text>
      </View>
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(0, Math.min(100, goal.progress))}%` as any,
              backgroundColor: goalColor,
            },
          ]}
        />
      </View>
      <View style={styles.metaRow}>
        {goal.targetAt !== null && (
          <Text style={[styles.deadline, overdue && styles.overdueText]}>
            📅 {formatDeadline(goal.targetAt)}
          </Text>
        )}
        {overdue && <Text style={styles.overdueText}>Overdue</Text>}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, overdue && styles.cardOverdue]}
        onPress={onPress}
        activeOpacity={0.85}>
        {Body}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, overdue && styles.cardOverdue]}>
      {Body}
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      gap: 2,
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 3,
    },
    cardOverdue: {
      backgroundColor: OVERDUE_COLOR + '16',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    goalText: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
      lineHeight: 16,
    },
    goalPct: {
      minWidth: 34,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '700',
    },
    progressBg: {
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: 3,
      borderRadius: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    deadline: {
      fontSize: 10,
      color: colors.textSecondary,
      lineHeight: 13,
    },
    overdueText: {
      fontSize: 10,
      color: OVERDUE_COLOR,
      fontWeight: '700',
      lineHeight: 13,
    },
  });
}
