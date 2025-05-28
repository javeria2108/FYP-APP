import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Octicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function PhysiotherapistSelection({ onSelect, goBack }) {
  const [loading, setLoading] = useState(true);
  const [physioList, setPhysioList] = useState([]);
  const [selectedPhysio, setSelectedPhysio] = useState(null);

  useEffect(() => {
    fetchPhysiotherapists();
  }, []);

  // Fetch all physiotherapists
  const fetchPhysiotherapists = async () => {
    try {
      setLoading(true);
      const physiosRef = collection(db, "users");
      const q = query(physiosRef, where("role", "==", "physiotherapist"));
      const querySnapshot = await getDocs(q);
      console.log("QuerySnapshot size:", querySnapshot.size);

      
      const physios = [];
      querySnapshot.forEach((doc) => {
        physios.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setPhysioList(physios);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching physiotherapists:", error);
      setLoading(false);
      Alert.alert("Error", "Failed to load physiotherapists. Please try again.");
    }
  };

  const handleSelect = () => {
    if (!selectedPhysio) {
      Alert.alert("Selection Required", "Please select a physiotherapist");
      return;
    }
    onSelect(selectedPhysio);
  };

  const renderPhysioItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.physioCard,
        selectedPhysio?.id === item.id && styles.selectedPhysioCard
      ]}
      onPress={() => setSelectedPhysio(item)}
    >
      <View style={styles.physioIconContainer}>
        <Octicons name="person" size={hp(3)} color="#4f46e5" />
      </View>
      <View style={styles.physioDetails}>
        <Text style={styles.physioName}>{item.firstName} {item.lastName}</Text>
        <Text style={styles.physioEmail}>{item.email}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Physiotherapist</Text>
      <Text style={styles.subtitle}>Choose a physiotherapist who will monitor your posture progress</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={styles.loader} />
      ) : physioList.length > 0 ? (
        <FlatList
          data={physioList}
          keyExtractor={(item) => item.id}
          renderItem={renderPhysioItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.physioList}
        />
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No physiotherapists available</Text>
          <Text style={styles.noDataSubtext}>You can continue without selecting one</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={goBack}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={handleSelect}
        >
          <Text style={styles.continueButtonText}>
            {physioList.length > 0 ? 'Continue with Selected' : 'Continue without Physio'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: wp(5),
    paddingTop: hp(4),
  },
  title: {
    fontSize: hp(3),
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: hp(2),
  },
  subtitle: {
    fontSize: hp(2),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: hp(4),
  },
  loader: {
    marginTop: hp(10),
  },
  physioList: {
    paddingBottom: hp(2),
  },
  physioCard: {
    flexDirection: 'row',
    padding: hp(2),
    backgroundColor: '#F9FAFB',
    borderRadius: hp(1.5),
    marginBottom: hp(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedPhysioCard: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  physioIconContainer: {
    width: hp(6),
    height: hp(6),
    borderRadius: hp(3),
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  physioDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  physioName: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: '#1F2937',
  },
  physioEmail: {
    fontSize: hp(1.8),
    color: '#6B7280',
    marginTop: hp(0.5),
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(10),
  },
  noDataText: {
    fontSize: hp(2.2),
    fontWeight: '500',
    color: '#4B5563',
  },
  noDataSubtext: {
    fontSize: hp(1.8),
    color: '#6B7280',
    marginTop: hp(1),
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(4),
    paddingBottom: hp(4),
  },
  backButton: {
    flex: 1,
    height: hp(6.5),
    backgroundColor: '#F3F4F6',
    borderRadius: hp(1.5),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(2),
  },
  backButtonText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: '#4B5563',
  },
  continueButton: {
    flex: 2,
    height: hp(6.5),
    backgroundColor: '#4f46e5',
    borderRadius: hp(1.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: 'white',
  },
});