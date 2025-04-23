import { View, Text, TextInput, TouchableOpacity, Pressable, Alert } from 'react-native';
import React, { useRef } from 'react';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { StatusBar } from 'expo-status-bar';
import { Octicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";


export default function SignUp() {
  const router = useRouter();
  const firstNameRef = useRef("");
  const lastNameRef = useRef("");
  const emailRef = useRef("");
  const passwordRef = useRef("");
  const confirmPasswordRef = useRef("");

  const handleSignUp = async () => {
    if (!firstNameRef.current || !lastNameRef.current || !emailRef.current || !passwordRef.current || !confirmPasswordRef.current) {
      Alert.alert("Sign Up", "Please fill all the fields");
      return;
    }
    if (passwordRef.current.length < 6) {
      Alert.alert("Sign Up", "Password must be at least 6 characters long");
      return;
    }
    if (passwordRef.current !== confirmPasswordRef.current) {
      Alert.alert("Sign Up", "Passwords do not match");
      return;
    }
  
    try {
      // Use the modular function correctly
      const userCredential = await createUserWithEmailAndPassword(auth, emailRef.current, passwordRef.current);
      
      console.log("User created successfully:", userCredential.user.email);
      Alert.alert("Success", "Account created successfully!");
  
      // Redirect to sign-in page
      router.push('/signIn');
    } catch (error) {
      console.error("Sign Up Failed:", error.message);
      Alert.alert("Sign Up Failed", error.message);
    }
  };
  

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

            <TouchableOpacity onPress={handleSignUp} style={{ height: hp(6.5) }} className="bg-indigo-500 rounded-xl justify-center items-center">
              <Text style={{ fontSize: hp(2.7) }} className="text-white font-bold tracking-wider">Sign Up</Text>
            </TouchableOpacity>

            <View className="flex-row justify-center">
              <Text style={{ fontSize: hp(1.8) }} className="font-semibold text-neutral-500">Already have an account? </Text>
              <Pressable onPress={() => router.push('/signIn')}>
                <Text style={{ fontSize: hp(1.8) }} className="font-semibold text-indigo-500">Sign In</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
