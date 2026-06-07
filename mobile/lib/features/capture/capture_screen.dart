import 'package:flutter/material.dart';

class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Capture Document')),
      body: const Center(
        child: Text('Camera + OCR — TODO: Milestone 2'),
      ),
    );
  }
}
