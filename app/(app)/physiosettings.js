import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Octicons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../firebase';
import PhysiotherapistSelection from './physiotherapistSelection';

export default function PhysioSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentPhysio, setCurrentPhysio] = useState(null);
  const [showPhysioSelection, setShowPhysioSelection] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
  
      // Get current user from Firebase Auth
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No authenticated user found. Please login again.");
        setLoading(false);
        return;
      }
  
      // Fetch the user document from Firestore
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (!userDoc.exists()) {
        Alert.alert("Error", "User profile not found. Please login again.");
        setLoading(false);
        return;
      }
      console.log("userDoc:",userDoc.data)
      const userData = { id: userDoc.id, ...userDoc.data() };
      setUser(userData);
      console.log('user:', userData.id)

      // If user has a physiotherapist, fetch their details
      if (userData.physiotherapistId) {
        await fetchPhysiotherapist(userData.physiotherapistId);
      }
  
      setLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      setLoading(false);
      Alert.alert("Error", "Failed to load your data. Please try again.");
    }
  };
  

  const fetchPhysiotherapist = async (physioId) => {
    try {
      const physioDoc = await getDoc(doc(db, "users", physioId));
      if (physioDoc.exists()) {
        setCurrentPhysio({
          id: physioDoc.id,
          ...physioDoc.data()
        });
      }
    } catch (error) {
      console.error("Error fetching physiotherapist:", error);
    }
  };

  const handleChangePhysio = () => {
    setShowPhysioSelection(true);
  };

  const handlePhysioSelection = async (selectedPhysio) => {
    setLoading(true);
    try {
      if (!user || !user.id) {
        throw new Error("User data not found");
      }

      // Reference to the user document
      const userRef = doc(db, "users", user.id);
      
      // If user already had a physiotherapist, remove user from their patients list
      if (user.physiotherapistId) {
        const oldPhysioRef = doc(db, "users", user.physiotherapistId);
        await updateDoc(oldPhysioRef, {
          patients: arrayRemove(user.id)
        });
      }
      
      // Update user with new physiotherapist ID (or null if no selection)
      const updateData = {
        physiotherapistId: selectedPhysio ? selectedPhysio.id : null
      };
      
      await updateDoc(userRef, updateData);
      
      // If a physiotherapist was selected, add user to their patients list
      if (selectedPhysio) {
        const physioRef = doc(db, "users", selectedPhysio.id);
        await updateDoc(physioRef, {
          patients: arrayUnion(user.id)
        });
      }
      
      // Update local state
      setCurrentPhysio(selectedPhysio);
      
      setUser(prevUser => ({
        ...prevUser,
        physiotherapistId: selectedPhysio ? selectedPhysio.id : null
      }));
      
      
      Alert.alert(
        "Success", 
        selectedPhysio 
          ? `Your physiotherapist has been updated to ${selectedPhysio.firstName} ${selectedPhysio.lastName}`
          : "Your physiotherapist has been removed"
      );
      
      setShowPhysioSelection(false);
    } catch (error) {
      console.error("Error updating physiotherapist:", error);
      Alert.alert("Error", "Failed to update your physiotherapist. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (showPhysioSelection) {
    return (
      <PhysiotherapistSelection 
        onSelect={handlePhysioSelection} 
        goBack={() => setShowPhysioSelection(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={hp(3)} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Physiotherapist Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Current Physiotherapist</Text>
          
          {currentPhysio ? (
            <View style={styles.physioCard}>
              <View style={styles.physioIconContainer}>
                <Octicons name="person" size={hp(3)} color="#4f46e5" />
              </View>
              <View style={styles.physioDetails}>
                <Text style={styles.physioName}>{currentPhysio.firstName} {currentPhysio.lastName}</Text>
                <Text style={styles.physioEmail}>{currentPhysio.email}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noPhysioContainer}>
              <View style={styles.noPhysioImageContainer}>
                <Octicons name="person-add" size={hp(5)} color="#6B7280" />
              </View>
              <Text style={styles.noPhysioText}>You don't have a physiotherapist assigned</Text>
              <Text style={styles.noPhysioSubtext}>A physiotherapist can monitor your posture and provide personalized recommendations</Text>
            </View>
          )}
        </View>

        {!currentPhysio ? (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleChangePhysio}
          >
            <Text style={styles.primaryButtonText}>Select a Physiotherapist</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <TouchableOpacity 
              style={styles.changeButton}
              onPress={handleChangePhysio}
            >
              <Text style={styles.changeButtonText}>Change Physiotherapist</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => handlePhysioSelection(null)}
            >
              <Text style={styles.removeButtonText}>Remove Physiotherapist</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: hp(1),
  },
  headerTitle: {
    fontSize: hp(2.5),
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: wp(3),
  },
  content: {
    flex: 1,
    padding: wp(5),
  },
  section: {
    marginBottom: hp(3),
  },
  sectionTitle: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: '#374151',
    marginBottom: hp(2),
  },
  physioCard: {
    flexDirection: 'row',
    padding: hp(2),
    backgroundColor: '#F9FAFB',
    borderRadius: hp(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  noPhysioContainer: {
    padding: hp(4),
    backgroundColor: '#F9FAFB',
    borderRadius: hp(1.5),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  noPhysioImageContainer: {
    width: hp(10),
    height: hp(10),
    borderRadius: hp(5),
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  noPhysioText: {
    fontSize: hp(2),
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: hp(1),
  },
  noPhysioSubtext: {
    fontSize: hp(1.8),
    color: '#6B7280',
    textAlign: 'center',
  },
  primaryButton: {
    height: hp(6.5),
    backgroundColor: '#4f46e5',
    borderRadius: hp(1.5),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  primaryButtonText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: 'white',
  },
  changeButton: {
    height: hp(6.5),
    backgroundColor: '#4f46e5',
    borderRadius: hp(1.5),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  changeButtonText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: 'white',
  },
  removeButton: {
    height: hp(6.5),
    backgroundColor: '#F3F4F6',
    borderRadius: hp(1.5),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  removeButtonText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: '#EF4444',
  },
});