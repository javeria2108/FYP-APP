import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>
    {children}
  </View>
);

export const CardHeader = ({ children, style }) => (
  <View style={[styles.cardHeader, style]}>
    {children}
  </View>
);

export const CardTitle = ({ children, style }) => (
  <Text style={[styles.cardTitle, style]}>
    {children}
  </Text>
);

export const CardContent = ({ children, style }) => (
  <View style={[styles.cardContent, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardContent: {
    // Any specific styles for content
  },
});