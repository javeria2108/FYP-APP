import { View, Text, TextInput, TouchableOpacity, Pressable, Alert, Switch } from 'react-native';
import React, { useRef, useState } from 'react';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { StatusBar } from 'expo-status-bar';
import { Octicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import PhysiotherapistSelection from './(app)/physiotherapistSelection';
import CalibrationScreen from './(app)/CalibrationScreen';

export default function SignUp() {
  const router = useRouter();
  const firstNameRef = useRef("");
  const lastNameRef = useRef("");
  const emailRef = useRef("");
  const passwordRef = useRef("");
  const confirmPasswordRef = useRef("");
  const [isPhysio, setIsPhysio] = useState(false);
  const [showPhysioSelection, setShowPhysioSelection] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [userCreated, setUserCreated] = useState(null);

  const validateFields = () => {
    if (!firstNameRef.current || !lastNameRef.current || !emailRef.current || !passwordRef.current || !confirmPasswordRef.current) {
      Alert.alert("Sign Up", "Please fill all the fields");
      return false;
    }
    if (passwordRef.current.length < 6) {
      Alert.alert("Sign Up", "Password must be at least 6 characters long");
      return false;
    }
    if (passwordRef.current !== confirmPasswordRef.current) {
      Alert.alert("Sign Up", "Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validateFields()) return;
  
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, emailRef.current, passwordRef.current);
      const user = userCredential.user;
      
      // Add user details to Firestore with role
      await setDoc(doc(db, "users", user.uid), {
        firstName: firstNameRef.current,
        lastName: lastNameRef.current,
        email: emailRef.current,
        role: isPhysio ? "physiotherapist" : "user",
        createdAt: new Date()
      });
      
      console.log("User created successfully:", user.email);
      
      if (!isPhysio) {
        // Set the user to be used in subsequent steps
        setUserCreated(user);
        
        // If regular user, move to physio selection
        setShowPhysioSelection(true);
      } else {
        // If physiotherapist, go directly to sign in
        Alert.alert("Success", "Account created successfully!");
        router.push('/signin');
      }
    } catch (error) {
      console.error("Sign Up Failed:", error.message);
      Alert.alert("Sign Up Failed", error.message);
    }
  };
  
  const handlePhysioSelection = async (selectedPhysio) => {
    if (!userCreated) return;
    
    try {
      // Update the user document with selected physiotherapist
      const userRef = doc(db, "users", userCreated.uid);
      await updateDoc(userRef, {
        physiotherapistId: selectedPhysio ? selectedPhysio.id : null
      });
      
      if (selectedPhysio) {
        // Add user to the physiotherapist's patients list
        const physioRef = doc(db, "users", selectedPhysio.id);
        await updateDoc(physioRef, {
          patients: arrayUnion(userCreated.uid)
        });
      }
      
      // Instead of alerting success, move to calibration
      setShowPhysioSelection(false);
      setShowCalibration(true);
    } catch (error) {
      console.error("Physiotherapist Selection Failed:", error.message);
      Alert.alert("Setup Failed", "Failed to connect with physiotherapist. You can update this later.");
      
      // Still move to calibration even if physio connection fails
      setShowPhysioSelection(false);
      setShowCalibration(true);
    }
  };

  const handleCalibrationComplete = () => {
    Alert.alert("Success", "Account setup and calibration completed!");
    router.push('/signin');
  };

  if (showCalibration) {
    return <CalibrationScreen onComplete={handleCalibrationComplete} />;
  }

  if (showPhysioSelection) {
    return <PhysiotherapistSelection 
      onSelect={handlePhysioSelection} 
      goBack={() => setShowPhysioSelection(false)} 
    />;
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <View style={{ paddingTop: hp(8), paddingHorizontal: wp(5) }} className="flex-1 gap-12">
        
        <View className="gap-10">
          <Text style={{ fontSize: hp(4) }} className="font-bold tracking-wider text-center text-neutral-800">Sign Up</Text>
          
          <View className="gap-4">
            <View style={{ height: hp(7) }} className="flex-row gap-4 px-4 bg-neutral-100 items-center rounded-2xl">
              <Octicons name='person' size={hp(2.7)} color='gray' />
              <TextInput onChangeText={value => firstNameRef.current = value} style={{ fontSize: hp(2) }} className="flex-1 font-semibold text-neutral-700" placeholder='First Name' placeholderTextColor={'gray'} />
            </View>

            <View style={{ height: hp(7) }} className="flex-row gap-4 px-4 bg-neutral-100 items-center rounded-2xl">
              <Octicons name='person' size={hp(2.7)} color='gray' />
              <TextInput onChangeText={value => lastNameRef.current = value} style={{ fontSize: hp(2) }} className="flex-1 font-semibold text-neutral-700" placeholder='Last Name' placeholderTextColor={'gray'} />
            </View>

            <View style={{ height: hp(7) }} className="flex-row gap-4 px-4 bg-neutral-100 items-center rounded-2xl">
              <Octicons name='mail' size={hp(2.7)} color='gray' />
              <TextInput onChangeText={value => emailRef.current = value} style={{ fontSize: hp(2) }} className="flex-1 font-semibold text-neutral-700" placeholder='Email Address' placeholderTextColor={'gray'} />
            </View>

            <View className="gap-3">
              <View style={{ height: hp(7) }} className="flex-row gap-4 px-4 bg-neutral-100 items-center rounded-2xl">
                <Octicons name='lock' size={hp(2.7)} color='gray' />
                <TextInput onChangeText={value => passwordRef.current = value} style={{ fontSize: hp(2) }} className="flex-1 font-semibold text-neutral-700" placeholder='Password' secureTextEntry placeholderTextColor={'gray'} />
              </View>

              <View style={{ height: hp(7) }} className="flex-row gap-4 px-4 bg-neutral-100 items-center rounded-2xl">
                <Octicons name='lock' size={hp(2.7)} color='gray' />
                <TextInput onChangeText={value => confirmPasswordRef.current = value} style={{ fontSize: hp(2) }} className="flex-1 font-semibold text-neutral-700" placeholder='Confirm Password' secureTextEntry placeholderTextColor={'gray'} />
              </View>
            </View>
            
            {/* Physiotherapist toggle switch */}
            <View style={{ height: hp(7) }} className="flex-row justify-between items-center px-4">
              <Text style={{ fontSize: hp(2) }} className="font-semibold text-neutral-700">Sign up as a Physiotherapist</Text>
              <Switch
                trackColor={{ false: "#767577", true: "#a5b4fc" }}
                thumbColor={isPhysio ? "#4f46e5" : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={() => setIsPhysio(previousState => !previousState)}
                value={isPhysio}
              />
            </View>

            <TouchableOpacity onPress={handleSignUp} style={{ height: hp(6.5) }} className="bg-indigo-500 rounded-xl justify-center items-center">
              <Text style={{ fontSize: hp(2.7) }} className="text-white font-bold tracking-wider">Sign Up</Text>
            </TouchableOpacity>

            <View className="flex-row justify-center">
              <Text style={{ fontSize: hp(1.8) }} className="font-semibold text-neutral-500">Already have an account? </Text>
              <Pressable onPress={() => router.push('/signin')}>
                <Text style={{ fontSize: hp(1.8) }} className="font-semibold text-indigo-500">Sign In</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}